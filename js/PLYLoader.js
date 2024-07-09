// PLYLoader.js content from Three.js repository

import {
  BufferGeometry,
  DefaultLoadingManager,
  FileLoader,
  Float32BufferAttribute,
  Loader,
} from "../../../build/three.module.js";

class PLYLoader extends Loader {
  constructor(manager) {
    super(manager);
  }

  load(url, onLoad, onProgress, onError) {
    const scope = this;

    const loader = new FileLoader(this.manager);
    loader.setPath(this.path);
    loader.setRequestHeader(this.requestHeader);
    loader.setWithCredentials(this.withCredentials);
    loader.load(
      url,
      function (text) {
        onLoad(scope.parse(text));
      },
      onProgress,
      onError
    );
  }

  parse(data) {
    function parseHeader(data) {
      const patternHeader = /ply([\s\S]*)end_header\r?\n/;
      let headerText = "";
      let headerLength = 0;
      const result = patternHeader.exec(data);

      if (result !== null) {
        headerText = result[1];
        headerLength = result[0].length;
      }

      const header = {
        comments: [],
        elements: [],
        headerLength: headerLength,
      };

      const lines = headerText.split("\n");
      let currentElement = null;

      function make_ply_element_property(propertValues, line) {
        const property = {};
        const values = line.split(/\s+/);
        const type = values[0];

        if (type === "list") {
          property.type = "list";
          property.countType = values[1];
          property.itemType = values[2];
          property.name = values[3];
        } else {
          property.type = type;
          property.name = values[1];
        }

        propertValues.push(property);
      }

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const lineValues = line.split(/\s+/);
        const lineType = lineValues[0];

        switch (lineType) {
          case "format":
            header.format = lineValues[1];
            header.version = lineValues[2];
            break;

          case "comment":
            header.comments.push(line);
            break;

          case "element":
            if (currentElement !== null) {
              header.elements.push(currentElement);
            }

            currentElement = {};
            currentElement.name = lineValues[1];
            currentElement.count = parseInt(lineValues[2]);
            currentElement.properties = [];
            break;

          case "property":
            make_ply_element_property(currentElement.properties, line);
            break;

          default:
            console.log("unhandled", lineValues);
        }
      }

      if (currentElement !== null) {
        header.elements.push(currentElement);
      }

      return header;
    }

    function binaryRead(dataview, at, type, little_endian) {
      switch (type) {
        // coerce to unsigned 8-bit
        case "uint8":
          return [dataview.getUint8(at, little_endian), 1];

        // coerce to signed 8-bit
        case "int8":
          return [dataview.getInt8(at, little_endian), 1];

        // coerce to unsigned 16-bit
        case "uint16":
          return [dataview.getUint16(at, little_endian), 2];

        // coerce to signed 16-bit
        case "int16":
          return [dataview.getInt16(at, little_endian), 2];

        // coerce to unsigned 32-bit
        case "uint32":
          return [dataview.getUint32(at, little_endian), 4];

        // coerce to signed 32-bit
        case "int32":
          return [dataview.getInt32(at, little_endian), 4];

        // coerce to 32-bit float
        case "float32":
          return [dataview.getFloat32(at, little_endian), 4];

        // coerce to 64-bit float
        case "float64":
          return [dataview.getFloat64(at, little_endian), 8];

        default:
          throw new Error("Unknown type: " + type);
      }
    }

    function parseBinary(data, header) {
      const little_endian = header.format === "binary_little_endian";
      const body = new DataView(data, header.headerLength);
      let result = {
        comments: header.comments,
        objects: [],
      };
      let loc = 0;

      for (
        let currentElement = 0;
        currentElement < header.elements.length;
        currentElement++
      ) {
        const current = header.elements[currentElement];

        let currentObject = {
          name: current.name,
          attributes: [],
        };

        for (
          let currentCount = 0;
          currentCount < current.count;
          currentCount++
        ) {
          let obj = {};

          for (
            let currentProperty = 0;
            currentProperty < current.properties.length;
            currentProperty++
          ) {
            const property = current.properties[currentProperty];
            let array;

            if (property.type === "list") {
              const listLength = binaryRead(
                body,
                loc,
                property.countType,
                little_endian
              );
              loc += listLength[1];

              array = [];
              for (let k = 0; k < listLength[0]; k++) {
                const value = binaryRead(
                  body,
                  loc,
                  property.itemType,
                  little_endian
                );
                loc += value[1];
                array.push(value[0]);
              }

              obj[property.name] = array;
            } else {
              const value = binaryRead(body, loc, property.type, little_endian);
              loc += value[1];
              obj[property.name] = value[0];
            }
          }

          currentObject.attributes.push(obj);
        }

        result.objects.push(currentObject);
      }

      return result;
    }

    function parseASCII(data) {
      const PLY_ELEMENT = /^element (\w+) (\d+)$/;
      const PLY_PROPERTY = /^property (\w+) (\w+)$/;
      const PLY_PROPERTY_LIST = /^property list (\w+) (\w+) (\w+)$/;

      let elements = {};
      let i = 0;

      let element = null;
      let properties = [];

      for (const line of data.split("\n")) {
        if (PLY_ELEMENT.test(line)) {
          element = null;
          const match = PLY_ELEMENT.exec(line);
          if (match !== null) {
            element = match[1];
            elements[element] = {
              count: parseInt(match[2]),
              properties: [],
            };
          }
        } else if (PLY_PROPERTY.test(line)) {
          const match = PLY_PROPERTY.exec(line);
          if (match !== null && element !== null) {
            properties.push({ name: match[2], type: match[1] });
          }
        } else if (PLY_PROPERTY_LIST.test(line)) {
          const match = PLY_PROPERTY_LIST.exec(line);
          if (match !== null && element !== null) {
            properties.push({
              name: match[3],
              type: match[1],
              listType: match[2],
            });
          }
        } else if (line.indexOf("end_header") === 0) {
          break;
        }

        i++;
      }

      let start = i;
      for (element in elements) {
        let propertyNames = [];
        for (let p = 0; p < properties.length; p++) {
          const property = properties[p];
          if (property.type === "list") {
            propertyNames.push(property.listType);
            propertyNames.push(property.name);
          } else {
            propertyNames.push(property.name);
          }
        }

        const geometry = new BufferGeometry();

        const values = [];
        let stride = 0;

        let vertexColors = false;

        for (let j = start; j < data.length; j++) {
          const line = data[j];
          if (line === "") continue;

          let matches = line.match(/\S+/g);
          if (matches.length === 0) continue;

          const valuesLine = {};

          for (let p = 0; p < properties.length; p++) {
            const property = properties[p];

            if (property.type === "list") {
              const name = property.name;
              const count = parseInt(matches.shift());
              const list = [];
              for (let l = 0; l < count; l++) {
                list.push(matches.shift());
              }

              valuesLine[name] = list;
            } else {
              valuesLine[property.name] = matches.shift();
            }
          }

          values.push(valuesLine);
        }

        const position = [];
        const normal = [];
        const color = [];
        const indices = [];

        for (let j = 0; j < values.length; j++) {
          const value = values[j];

          if (
            properties[0].name === "vertex_index" ||
            properties[0].name === "vertex_indices"
          ) {
            const list = value[properties[0].name];
            indices.push(list[0]);
            indices.push(list[1]);
            indices.push(list[2]);
          } else {
            position.push(value.x);
            position.push(value.y);
            position.push(value.z);

            if ("nx" in value && "ny" in value && "nz" in value) {
              normal.push(value.nx);
              normal.push(value.ny);
              normal.push(value.nz);
            }

            if ("red" in value && "green" in value && "blue" in value) {
              vertexColors = true;

              color.push(value.red / 255.0);
              color.push(value.green / 255.0);
              color.push(value.blue / 255.0);
            }
          }
        }

        geometry.setAttribute(
          "position",
          new Float32BufferAttribute(position, 3)
        );

        if (normal.length > 0) {
          geometry.setAttribute(
            "normal",
            new Float32BufferAttribute(normal, 3)
          );
        }

        if (color.length > 0) {
          geometry.setAttribute("color", new Float32BufferAttribute(color, 3));
        }

        if (indices.length > 0) {
          geometry.setIndex(indices);
        }

        result = geometry;
      }

      return result;
    }

    const header = parseHeader(data);

    if (header.format === "ascii") {
      return parseASCII(data, header);
    } else {
      return parseBinary(data, header);
    }
  }
}

export { PLYLoader };
