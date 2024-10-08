import React, { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import MapboxDraw from "@mapbox/mapbox-gl-draw";
import * as turf from "@turf/turf";
import { Modal, Input } from "antd";
import "mapbox-gl/dist/mapbox-gl.css";
import "@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css";
import "antd/dist/reset.css";

const mockApi = async () => {
  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [-91.87, 42.77],
              [-91.87, 42.75],
              [-91.85, 42.75],
              [-91.85, 42.77],
              [-91.87, 42.77],
            ],
          ],
        },
        properties: {
          name: "Test Polygon 2",
        },
      },
    ],
  };
};

const MapboxExample = () => {
  const mapContainerRef = useRef();
  const mapRef = useRef();
  const drawRef = useRef();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [polygonName, setPolygonName] = useState("");
  const [currentPolygonId, setCurrentPolygonId] = useState(null);

  useEffect(() => {
    mapboxgl.accessToken =
      "pk.eyJ1IjoiY3JlYXRpdmVsZWFkc21rIiwiYSI6ImNtMW90bTVwazA2ZzYybXNlbWdnOWJoZXMifQ.-hvJggiAtS5-tvwpifvYiQ";

    // Initialize the map
    mapRef.current = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: "mapbox://styles/mapbox/satellite-v9",
      center: [-91.874, 42.76],
      zoom: 12,
    });

    // Initialize the draw control
    drawRef.current = new MapboxDraw({
      displayControlsDefault: false,
      controls: {
        polygon: true,
        trash: true,
        line_string: true,
      },
    });

    mapRef.current.addControl(drawRef.current);

    // Add NavigationControl for zooming in and out
    const navControls = new mapboxgl.NavigationControl();
    mapRef.current.addControl(navControls, "top-right");

    // Load mock polygons from the API
    const loadPolygons = async () => {
      const data = await mockApi();
      if (data && data.features) {
        mapRef.current.addSource("polygons", {
          type: "geojson",
          data: data,
        });

        mapRef.current.addLayer({
          id: "polygon-layer",
          type: "fill",
          source: "polygons",
          layout: {},
          paint: {
            "fill-color": "#d09a7f",
            "fill-opacity": 0.5,
          },
        });

        mapRef.current.addLayer({
          id: "polygon-outline",
          type: "line",
          source: "polygons",
          layout: {},
          paint: {
            "line-color": "#000",
            "line-width": 2,
          },
        });
      }
    };

    mapRef.current.on("load", loadPolygons);

    // Event listener for polygon or line creation
    mapRef.current.on("draw.create", (e) => {
      if (e.features[0].geometry.type === "Polygon") {
        const polygonId = e.features[0].id;
        setCurrentPolygonId(polygonId);
        setIsModalOpen(true);
      } else if (e.features[0].geometry.type === "LineString") {
        const coordinates = e.features[0].geometry.coordinates;

        // Restrict line to only two points
        if (coordinates.length > 2) {
          const truncatedLine = {
            ...e.features[0],
            geometry: {
              ...e.features[0].geometry,
              coordinates: coordinates.slice(0, 2), // Keep only two points
            },
          };

          // Replace the original line with the truncated one
          drawRef.current.delete(e.features[0].id);
          drawRef.current.add(truncatedLine);
        }

        addArrowLayer(e.features[0]);
      }
    });

    return () => {
      if (mapRef.current) mapRef.current.remove();
    };
  }, []);

  // Function to add arrow layer at the midpoint of the LineString
  const addArrowLayer = (lineFeature) => {
    const coordinates = lineFeature.geometry.coordinates;

    if (coordinates.length < 2) return;

    const start = coordinates[0];
    const end = coordinates[1];

    // Calculate the midpoint using Turf.js
    const midpoint = turf.midpoint(turf.point(start), turf.point(end)).geometry
      .coordinates;

    // Calculate the bearing using Turf.js
    const bearing = turf.bearing(turf.point(start), turf.point(end));

    const url = "images/arrow.png"; // Replace with the correct image path
    mapRef.current.loadImage(url, (err, image) => {
      if (err) {
        console.error("Error loading arrow image:", err);
        return;
      }

      if (!mapRef.current.hasImage("arrow")) {
        mapRef.current.addImage("arrow", image); // Only add the image once
      }

      // Remove existing arrow layer if it exists for this line
      const arrowLayerId = `arrow-${lineFeature.id}`;
      if (mapRef.current.getLayer(arrowLayerId)) {
        mapRef.current.removeLayer(arrowLayerId);
        mapRef.current.removeSource(arrowLayerId);
      }

      // Add arrow symbol at the midpoint with rotation using the bearing
      mapRef.current.addLayer({
        id: arrowLayerId, // Unique ID for each line
        type: "symbol",
        source: {
          type: "geojson",
          data: {
            type: "FeatureCollection",
            features: [
              {
                type: "Feature",
                geometry: {
                  type: "Point",
                  coordinates: midpoint,
                },
                properties: {
                  rotation: bearing + 275, // Use bearing for rotation
                },
              },
            ],
          },
        },
        layout: {
          "icon-image": "arrow",
          "icon-size": 0.045,
          "icon-rotate": ["get", "rotation"], // Rotate the arrow using the bearing
          "icon-allow-overlap": true,
        },
      });
    });
  };

  const handleOk = () => {
    console.log("Polygon Name: ", polygonName);
    console.log("Polygon ID: ", currentPolygonId);
    setIsModalOpen(false);
    setPolygonName("");
  };

  const handleCancel = () => {
    setIsModalOpen(false);
    setPolygonName("");
  };

  return (
    <>
      <div
        ref={mapContainerRef}
        id="map"
        style={{ height: "100vh", width: "100vw" }}
      ></div>
      <div
        className="calculation-box"
        style={{
          height: 75,
          width: 150,
          position: "absolute",
          bottom: 40,
          left: 10,
          backgroundColor: "rgba(255, 255, 255, 0.9)",
          padding: 15,
          textAlign: "center",
        }}
      >
        <p style={{ fontFamily: "Open Sans", margin: 0, fontSize: 13 }}>
          Click the map to draw a polygon or line.
        </p>
      </div>

      <Modal
        title="Enter Polygon Name"
        open={isModalOpen}
        onOk={handleOk}
        onCancel={handleCancel}
        maskClosable={false}
      >
        <Input
          value={polygonName}
          onChange={(e) => setPolygonName(e.target.value)}
          placeholder="Polygon Name"
        />
      </Modal>
    </>
  );
};

export default MapboxExample;
