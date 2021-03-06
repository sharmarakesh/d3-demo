import { Component, OnInit, ViewEncapsulation } from '@angular/core';
import * as d3 from 'd3';

@Component({
  selector: 'app-map',
  templateUrl: './map.component.html',
  styleUrls: ['../../common/common.css', './map.component.css'],
  encapsulation: ViewEncapsulation.None,
})
export class MapComponent implements OnInit {
  private code: string;

  constructor() { }

  ngOnInit() {
    const w = 500;
    const h = 300;

    // Define map projection
    const projection = d3.geoAlbersUsa()
      .translate([0, 0]);

    // Define path generator
    const path = d3.geoPath()
      .projection(projection);

    // Define quantize scale to sort data values into buckets of color
    const color = d3.scaleQuantize()
      .range(['rgb(237,248,233)', 'rgb(186,228,179)', 'rgb(116,196,118)', 'rgb(49,163,84)', 'rgb(0,109,44)']);
    // Colors taken from colorbrewer.js, included in the D3 download

    // Number formatting for population values
    const formatAsThousands = d3.format(',');  // e.g. converts 123456 to '123,456'

    // Number formatting for ag productivity values
    const formatDecimals = d3.format('.3');  // e.g. converts 1.23456 to '1.23'

    // Create SVG element
    const svg = d3.select('.result')
      .append('svg')
      .attr('width', w)
      .attr('height', h);

    // Define what to do when panning or zooming
    const zooming = function (d) {

      // Log out d3.event.transform, so you can see all the goodies inside
      // console.log(d3.event.transform);

      // New offset array
      const offset = [d3.event.transform.x, d3.event.transform.y];

      // Calculate new scale
      const newScale = d3.event.transform.k * 2000;

      // Update projection with new offset and scale
      projection.translate(offset)
        .scale(newScale);

      // Update all paths and circles
      svg.selectAll('path')
        .attr('d', path);

      svg.selectAll('circle')
        .attr('cx', function (dd) {
          return projection([dd.lon, dd.lat])[0];
        })
        .attr('cy', function (dd) {
          return projection([dd.lon, dd.lat])[1];
        });

      svg.selectAll('.label')
        .attr('x', function (dd) {
          return path.centroid(dd)[0];
        })
        .attr('y', function (dd) {
          return path.centroid(dd)[1];
        });
    };

    // Then define the zoom behavior
    const zoom = d3.zoom()
      .scaleExtent([0.2, 2.0])
      .translateExtent([[-1200, -700], [1200, 700]])
      .on('zoom', zooming);

    // The center of the country, roughly
    const center = projection([-97.0, 39.0]);

    // Create a container in which all zoom-able elements will live
    const map = svg.append('g')
      .attr('id', 'map')
      .call(zoom)  // Bind the zoom behavior
      .call(zoom.transform, d3.zoomIdentity  // Then apply the initial transform
        .translate(w / 2, h / 2)
        .scale(0.25)
        .translate(-center[0], -center[1]));

    // Create a new, invisible background rect to catch zoom events
    map.append('rect')
      .attr('x', 0)
      .attr('y', 0)
      .attr('width', w)
      .attr('height', h)
      .attr('opacity', 0);

    // Load in agriculture data
    d3.csv('assets/us-ag-productivity.csv', function (data) {

      // Set input domain for color scale
      color.domain([
        d3.min(data, function (d) { return d.value; }),
        d3.max(data, function (d) { return d.value; })
      ]);

      // Load in GeoJSON data
      d3.json('assets/us-states.json', function (json) {

        // Merge the ag. data and GeoJSON
        // Loop through once for each ag. data value
        for (let i = 0; i < data.length; i++) {

          const dataState = data[i].state;				// Grab state name
          const dataValue = parseFloat(data[i].value);	// Grab data value, and convert from string to float

          // Find the corresponding state inside the GeoJSON
          for (let j = 0; j < json.features.length; j++) {

            const jsonState = json.features[j].properties.name;

            if (dataState === jsonState) {

              // Copy the data value into the JSON
              json.features[j].properties.value = dataValue;

              // Stop looking through the JSON
              break;

            }
          }
        }

        // Bind data and create one path per GeoJSON feature
        map.selectAll('path')
          .data(json.features)
          .enter()
          .append('path')
          .attr('d', path)
          .style('fill', function (d) {
            // Get data value
            const value = d.properties.value;

            if (value) {
              // If value exists…
              return color(value);
            } else {
              // If value is undefined…
              return '#ccc';
            }
          });

        // Create one label per state
        map.selectAll('text')
          .data(json.features)
          .enter()
          .append('text')
          .attr('class', 'label')
          .attr('x', function (d) {
            return path.centroid(d)[0];
          })
          .attr('y', function (d) {
            return path.centroid(d)[1];
          })
          .text(function (d) {
            if (d.properties.value) {
              return formatDecimals(d.properties.value);
            }
          });

        // Load in cities data
        d3.csv('assets/us-cities.csv', function (result) {

          map.selectAll('circle')
            .data(result)
            .enter()
            .append('circle')
            .attr('cx', function (d) {
              return projection([d.lon, d.lat])[0];
            })
            .attr('cy', function (d) {
              return projection([d.lon, d.lat])[1];
            })
            .attr('r', function (d) {
              return Math.sqrt(parseInt(d.population, 10) * 0.00004);
            })
            .style('fill', 'yellow')
            .style('stroke', 'gray')
            .style('stroke-width', 0.25)
            .style('opacity', 0.75)
            .append('title')			// Simple tooltip
            .text(function (d) {
              return d.place + ': Pop. ' + formatAsThousands(d.population);
            });

          createPanButtons();
          createZoomButtons();

        });


      });

    });

    // Create panning buttons
    const createPanButtons = function () {

      // Create the clickable groups

      // North
      const north = svg.append('g')
        .attr('class', 'pan')	// All share the 'pan' class
        .attr('id', 'north');	// The ID will tell us which direction to head

      north.append('rect')
        .attr('x', 0)
        .attr('y', 0)
        .attr('width', w)
        .attr('height', 30);

      north.append('text')
        .attr('x', w / 2)
        .attr('y', 20)
        .html('&uarr;');

      // South
      const south = svg.append('g')
        .attr('class', 'pan')
        .attr('id', 'south');

      south.append('rect')
        .attr('x', 0)
        .attr('y', h - 30)
        .attr('width', w)
        .attr('height', 30);

      south.append('text')
        .attr('x', w / 2)
        .attr('y', h - 10)
        .html('&darr;');

      // West
      const west = svg.append('g')
        .attr('class', 'pan')
        .attr('id', 'west');

      west.append('rect')
        .attr('x', 0)
        .attr('y', 30)
        .attr('width', 30)
        .attr('height', h - 60);

      west.append('text')
        .attr('x', 15)
        .attr('y', h / 2)
        .html('&larr;');

      // East
      const east = svg.append('g')
        .attr('class', 'pan')
        .attr('id', 'east');

      east.append('rect')
        .attr('x', w - 30)
        .attr('y', 30)
        .attr('width', 30)
        .attr('height', h - 60);

      east.append('text')
        .attr('x', w - 15)
        .attr('y', h / 2)
        .html('&rarr;');

      // Panning interaction

      d3.selectAll('.pan')
        .on('click', function () {

          // Set how much to move on each click
          const moveAmount = 50;

          // Set x/y to zero for now
          let x = 0;
          let y = 0;

          // Which way are we headed?
          const direction = d3.select(this).attr('id');

          // Modify the offset, depending on the direction
          switch (direction) {
            case 'north':
              y += moveAmount;  // Increase y offset
              break;
            case 'south':
              y -= moveAmount;  // Decrease y offset
              break;
            case 'west':
              x += moveAmount;  // Increase x offset
              break;
            case 'east':
              x -= moveAmount;  // Decrease x offset
              break;
            default:
              break;
          }

          // This triggers a zoom event, translating by x, y
          map.transition()
            .call(zoom.translateBy, x, y);

        });

    };

    // Create zoom buttons
    const createZoomButtons = function () {

      // Create the clickable groups

      // Zoom in button
      const zoomIn = svg.append('g')
        .attr('class', 'zoom')	// All share the 'zoom' class
        .attr('id', 'in')		// The ID will tell us which direction to head
        .attr('transform', 'translate(' + (w - 110) + ',' + (h - 70) + ')');

      zoomIn.append('rect')
        .attr('x', 0)
        .attr('y', 0)
        .attr('width', 30)
        .attr('height', 30);

      zoomIn.append('text')
        .attr('x', 15)
        .attr('y', 20)
        .text('+');

      // Zoom out button
      const zoomOut = svg.append('g')
        .attr('class', 'zoom')
        .attr('id', 'out')
        .attr('transform', 'translate(' + (w - 70) + ',' + (h - 70) + ')');

      zoomOut.append('rect')
        .attr('x', 0)
        .attr('y', 0)
        .attr('width', 30)
        .attr('height', 30);

      zoomOut.append('text')
        .attr('x', 15)
        .attr('y', 20)
        .html('&ndash;');

      // Zooming interaction

      d3.selectAll('.zoom')
        .on('click', function () {

          // Set how much to scale on each click
          let scaleFactor;

          // Which way are we headed?
          const direction = d3.select(this).attr('id');

          // Modify the k scale value, depending on the direction
          switch (direction) {
            case 'in':
              scaleFactor = 1.5;
              break;
            case 'out':
              scaleFactor = 0.75;
              break;
            default:
              break;
          }

          // This triggers a zoom event, scaling by 'scaleFactor'
          map.transition()
            .call(zoom.scaleBy, scaleFactor);

        });

    };

    // Bind 'Pacific Northwest' button behavior
    d3.select('#pnw')
      .on('click', function () {

        map.transition()
          .call(zoom.transform, d3.zoomIdentity
            .translate(w / 2, h / 2)
            .scale(0.9)
            .translate(600, 300));

      });

    // Bind 'Reset' button behavior
    d3.select('#reset')
      .on('click', function () {

        map.transition()
          .call(zoom.transform, d3.zoomIdentity  // Same as the initial transform
            .translate(w / 2, h / 2)
            .scale(0.25)
            .translate(-center[0], -center[1]));

      });
    this.code = `const w = 500;
const h = 300;

// Define map projection
const projection = d3.geoAlbersUsa()
  .translate([0, 0]);

// Define path generator
const path = d3.geoPath()
  .projection(projection);

// Define quantize scale to sort data values into buckets of color
const color = d3.scaleQuantize()
  .range(['rgb(237,248,233)', 'rgb(186,228,179)', 'rgb(116,196,118)', 'rgb(49,163,84)', 'rgb(0,109,44)']);
// Colors taken from colorbrewer.js, included in the D3 download

// Number formatting for population values
const formatAsThousands = d3.format(',');  // e.g. converts 123456 to '123,456'

// Number formatting for ag productivity values
const formatDecimals = d3.format('.3');  // e.g. converts 1.23456 to '1.23'

// Create SVG element
const svg = d3.select('.result')
  .append('svg')
  .attr('width', w)
  .attr('height', h);

// Define what to do when panning or zooming
const zooming = function (d) {

  // Log out d3.event.transform, so you can see all the goodies inside
  // console.log(d3.event.transform);

  // New offset array
  const offset = [d3.event.transform.x, d3.event.transform.y];

  // Calculate new scale
  const newScale = d3.event.transform.k * 2000;

  // Update projection with new offset and scale
  projection.translate(offset)
    .scale(newScale);

  // Update all paths and circles
  svg.selectAll('path')
    .attr('d', path);

  svg.selectAll('circle')
    .attr('cx', function (dd) {
      return projection([dd.lon, dd.lat])[0];
    })
    .attr('cy', function (dd) {
      return projection([dd.lon, dd.lat])[1];
    });

  svg.selectAll('.label')
    .attr('x', function (dd) {
      return path.centroid(dd)[0];
    })
    .attr('y', function (dd) {
      return path.centroid(dd)[1];
    });
};

// Then define the zoom behavior
const zoom = d3.zoom()
  .scaleExtent([0.2, 2.0])
  .translateExtent([[-1200, -700], [1200, 700]])
  .on('zoom', zooming);

// The center of the country, roughly
const center = projection([-97.0, 39.0]);

// Create a container in which all zoom-able elements will live
const map = svg.append('g')
  .attr('id', 'map')
  .call(zoom)  // Bind the zoom behavior
  .call(zoom.transform, d3.zoomIdentity  // Then apply the initial transform
    .translate(w / 2, h / 2)
    .scale(0.25)
    .translate(-center[0], -center[1]));

// Create a new, invisible background rect to catch zoom events
map.append('rect')
  .attr('x', 0)
  .attr('y', 0)
  .attr('width', w)
  .attr('height', h)
  .attr('opacity', 0);

// Load in agriculture data
d3.csv('assets/us-ag-productivity.csv', function (data) {

  // Set input domain for color scale
  color.domain([
    d3.min(data, function (d) { return d.value; }),
    d3.max(data, function (d) { return d.value; })
  ]);

  // Load in GeoJSON data
  d3.json('assets/us-states.json', function (json) {

    // Merge the ag. data and GeoJSON
    // Loop through once for each ag. data value
    for (let i = 0; i < data.length; i++) {

      const dataState = data[i].state;				// Grab state name
      const dataValue = parseFloat(data[i].value);	// Grab data value, and convert from string to float

      // Find the corresponding state inside the GeoJSON
      for (let j = 0; j < json.features.length; j++) {

        const jsonState = json.features[j].properties.name;

        if (dataState === jsonState) {

          // Copy the data value into the JSON
          json.features[j].properties.value = dataValue;

          // Stop looking through the JSON
          break;

        }
      }
    }

    // Bind data and create one path per GeoJSON feature
    map.selectAll('path')
      .data(json.features)
      .enter()
      .append('path')
      .attr('d', path)
      .style('fill', function (d) {
        // Get data value
        const value = d.properties.value;

        if (value) {
          // If value exists…
          return color(value);
        } else {
          // If value is undefined…
          return '#ccc';
        }
      });

    // Create one label per state
    map.selectAll('text')
      .data(json.features)
      .enter()
      .append('text')
      .attr('class', 'label')
      .attr('x', function (d) {
        return path.centroid(d)[0];
      })
      .attr('y', function (d) {
        return path.centroid(d)[1];
      })
      .text(function (d) {
        if (d.properties.value) {
          return formatDecimals(d.properties.value);
        }
      });

    // Load in cities data
    d3.csv('assets/us-cities.csv', function (result) {

      map.selectAll('circle')
        .data(result)
        .enter()
        .append('circle')
        .attr('cx', function (d) {
          return projection([d.lon, d.lat])[0];
        })
        .attr('cy', function (d) {
          return projection([d.lon, d.lat])[1];
        })
        .attr('r', function (d) {
          return Math.sqrt(parseInt(d.population, 10) * 0.00004);
        })
        .style('fill', 'yellow')
        .style('stroke', 'gray')
        .style('stroke-width', 0.25)
        .style('opacity', 0.75)
        .append('title')			// Simple tooltip
        .text(function (d) {
          return d.place + ': Pop. ' + formatAsThousands(d.population);
        });

      createPanButtons();
      createZoomButtons();

    });


  });

});

// Create panning buttons
const createPanButtons = function () {

  // Create the clickable groups

  // North
  const north = svg.append('g')
    .attr('class', 'pan')	// All share the 'pan' class
    .attr('id', 'north');	// The ID will tell us which direction to head

  north.append('rect')
    .attr('x', 0)
    .attr('y', 0)
    .attr('width', w)
    .attr('height', 30);

  north.append('text')
    .attr('x', w / 2)
    .attr('y', 20)
    .html('&uarr;');

  // South
  const south = svg.append('g')
    .attr('class', 'pan')
    .attr('id', 'south');

  south.append('rect')
    .attr('x', 0)
    .attr('y', h - 30)
    .attr('width', w)
    .attr('height', 30);

  south.append('text')
    .attr('x', w / 2)
    .attr('y', h - 10)
    .html('&darr;');

  // West
  const west = svg.append('g')
    .attr('class', 'pan')
    .attr('id', 'west');

  west.append('rect')
    .attr('x', 0)
    .attr('y', 30)
    .attr('width', 30)
    .attr('height', h - 60);

  west.append('text')
    .attr('x', 15)
    .attr('y', h / 2)
    .html('&larr;');

  // East
  const east = svg.append('g')
    .attr('class', 'pan')
    .attr('id', 'east');

  east.append('rect')
    .attr('x', w - 30)
    .attr('y', 30)
    .attr('width', 30)
    .attr('height', h - 60);

  east.append('text')
    .attr('x', w - 15)
    .attr('y', h / 2)
    .html('&rarr;');

  // Panning interaction

  d3.selectAll('.pan')
    .on('click', function () {

      // Set how much to move on each click
      const moveAmount = 50;

      // Set x/y to zero for now
      let x = 0;
      let y = 0;

      // Which way are we headed?
      const direction = d3.select(this).attr('id');

      // Modify the offset, depending on the direction
      switch (direction) {
        case 'north':
          y += moveAmount;  // Increase y offset
          break;
        case 'south':
          y -= moveAmount;  // Decrease y offset
          break;
        case 'west':
          x += moveAmount;  // Increase x offset
          break;
        case 'east':
          x -= moveAmount;  // Decrease x offset
          break;
        default:
          break;
      }

      // This triggers a zoom event, translating by x, y
      map.transition()
        .call(zoom.translateBy, x, y);

    });

};

// Create zoom buttons
const createZoomButtons = function () {

  // Create the clickable groups

  // Zoom in button
  const zoomIn = svg.append('g')
    .attr('class', 'zoom')	// All share the 'zoom' class
    .attr('id', 'in')		// The ID will tell us which direction to head
    .attr('transform', 'translate(' + (w - 110) + ',' + (h - 70) + ')');

  zoomIn.append('rect')
    .attr('x', 0)
    .attr('y', 0)
    .attr('width', 30)
    .attr('height', 30);

  zoomIn.append('text')
    .attr('x', 15)
    .attr('y', 20)
    .text('+');

  // Zoom out button
  const zoomOut = svg.append('g')
    .attr('class', 'zoom')
    .attr('id', 'out')
    .attr('transform', 'translate(' + (w - 70) + ',' + (h - 70) + ')');

  zoomOut.append('rect')
    .attr('x', 0)
    .attr('y', 0)
    .attr('width', 30)
    .attr('height', 30);

  zoomOut.append('text')
    .attr('x', 15)
    .attr('y', 20)
    .html('&ndash;');

  // Zooming interaction

  d3.selectAll('.zoom')
    .on('click', function () {

      // Set how much to scale on each click
      let scaleFactor;

      // Which way are we headed?
      const direction = d3.select(this).attr('id');

      // Modify the k scale value, depending on the direction
      switch (direction) {
        case 'in':
          scaleFactor = 1.5;
          break;
        case 'out':
          scaleFactor = 0.75;
          break;
        default:
          break;
      }

      // This triggers a zoom event, scaling by 'scaleFactor'
      map.transition()
        .call(zoom.scaleBy, scaleFactor);

    });

};

// Bind 'Pacific Northwest' button behavior
d3.select('#pnw')
  .on('click', function () {

    map.transition()
      .call(zoom.transform, d3.zoomIdentity
        .translate(w / 2, h / 2)
        .scale(0.9)
        .translate(600, 300));

  });

// Bind 'Reset' button behavior
d3.select('#reset')
  .on('click', function () {

    map.transition()
      .call(zoom.transform, d3.zoomIdentity  // Same as the initial transform
        .translate(w / 2, h / 2)
        .scale(0.25)
        .translate(-center[0], -center[1]));

  });`;
  }

}
