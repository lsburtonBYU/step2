/**
 * Creates and compiles a shader from GLSL source code
 *
 * @param {!WebGLRenderingContext } gl The current WebGL rendering context
 * @param {!string} shaderSource The shader source code text in GLSL
 * @param {!number} shaderType The type of shader to create, either gl.VERTEX_SHADER or gl.FRAGMENT_SHADER
 * @throws {Error} If shader cannot be compiled
 * @returns {!WebGLShader} The compiled shader
 */
function makeShader(gl, shaderSource, shaderType) {
  const newShader = gl.createShader(shaderType);
  gl.shaderSource(newShader, shaderSource);
  gl.compileShader(newShader);
  if (!gl.getShaderParameter(newShader, gl.COMPILE_STATUS)) {
    gl.deleteShader(newShader);
    throw new Error(
      `ERROR compiling ${
        shaderType === gl.VERTEX_SHADER ? "vertex" : "fragment"
      } shader: ${gl.getShaderInfoLog(newShader)}`
    );
  }
  return newShader;
}

/**
 * Creates a WebGLProgram, attaches a vertex and a fragment shader, then links
 * the program, with the option to validate the program.
 *
 * @param {!WebGLRenderingContext } gl The current WebGL rendering context
 * @param {!WebGLShader} vertexShader A compiled vertex shader
 * @param {!WebGLShader} fragmentShader A compiled fragment shader
 * @param {boolean} validate If true, will validate the program before returning it
 * @throws {Error} If program can't be linked
 * @throws {Error} If validate is true and the program can't be validated
 * @returns {!WebGLProgram}
 */
function makeProgram(gl, vertexShader, fragmentShader, validate = true) {
  const program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);

  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error("ERROR linking program: " + gl.getProgramInfoLog(program));
  }
  if (validate) {
    gl.validateProgram(program);
    if (!gl.getProgramParameter(program, gl.VALIDATE_STATUS)) {
      throw new Error(
        "ERROR validating program: " + gl.getProgramInfoLog(program)
      );
    }
  }

  return program;
}

/**
 * Creates a program from 2 script tags.
 *
 * @param {!WebGLRenderingContext} gl The WebGL Context.
 * @param {string[]} shaderIds Array of ids names (no # prefix) of the script
 *        tags for the shaders. The first is assumed to be the
 *        vertex shader, the second the fragment shader.
 * @return {!WebGLProgram} A program
 */
function makeProgramFromScripts(gl, shaderIds) {
  const vertexShader = makeShader(
    gl,
    document.querySelector(`#${shaderIds[0]}`).textContent,
    gl.VERTEX_SHADER
  );

  const fragmentShader = makeShader(
    gl,
    document.querySelector(`#${shaderIds[1]}`).textContent,
    gl.FRAGMENT_SHADER
  );

  return makeProgram(gl, vertexShader, fragmentShader);
}

/**
 * Description of color object for WebGL color
 *
 * @typedef {object} ColorObject
 * @property {number} red Value of red from 0.0 to 1.0
 * @property {number} green Value of green from 0.0 to 1.0
 * @property {number} blue Value of blue from 0.0 to 1.0
 * @property {number} alpha Value of alpha from 0.0 to 1.0
 */

/**
 * Description of attribute object
 *
 * @typedef {object} AttributeObject
 * @property {string} name the name of the attribute to be used in the GLSL code
 * @property {number} size the number of elements for this attribute; must be 1,2,3, or 4
 * @property {number} stride the size in bytes of one full vertex
 * @property {number} offset the offset in bytes of this attribute in the full vertex
 * @property {number} type Data type of each component: gl.BYTE, gl.SHORT, gl.UNSIGNED_BYTE, gl.UNSIGNED_SHORT, gl.FLOAT
 * @property {boolean} normalized If true, integer data values normalized when being cast to a float
 */

/**
 * Creates an attribute object from the parameters
 *
 * @param {string} name The attribute (variable) name that will be accessed in the GLSL code
 * @param {number} numElements The number of elements for this attribute. Must be 1, 2, 3, or 4.
 * @param {number} numVertex  Number elements in the full vertex
 * @param {string} type Data type of each component: gl.BYTE, gl.SHORT, gl.UNSIGNED_BYTE, gl.UNSIGNED_SHORT, gl.FLOAT
 * @param {number} offset  Offset of this attribute in the full vertex
 * @param {number} typeSize size of the data type
 * @param {boolean} normalized If true, integer data values normalized when being cast to a float
 * @returns {AttributeObject} An attribute object used in the {@link createBuffer} to set the attribute pointed
 */
export function createAttribute(
  name,
  numElements,
  numVertex,
  type,
  offset = 0,
  typeSize = Float32Array.BYTES_PER_ELEMENT,
  normalized = false
) {
  return {
    name: name,
    size: numElements,
    stride: numVertex * typeSize,
    offset: offset * typeSize,
    type: type,
    normalized: normalized,
  };
}

/**
 * Create a buffer from the buffer data and configure attributes
 *
 * @param {!WebGLRenderingContext } gl The current WebGL rendering context
 * @param {!WebGLProgram} program The WebGL complied and linked program
 * @param {!Float32Array} bufferData An array of elements
 * @param {!Array<AttributeObject>} attributes Attribute descriptions generated from {@link createAttribute}
 * @param {number} type Buffer type from a GLenum; default is gl.ARRAY_BUFFER
 * @param {number} bufferDataType Buffer data type from a GLenum; default is gl.STATIC_DRAW
 */
function createBuffer(
  gl,
  program,
  bufferData,
  attributes,
  type = gl.ARRAY_BUFFER,
  bufferDataType = gl.STATIC_DRAW
) {
  const buffer = gl.createBuffer();
  gl.bindBuffer(type, buffer);
  gl.bufferData(type, bufferData, bufferDataType);

  attributes.forEach((attr) => {
    const attrLocation = gl.getAttribLocation(program, attr.name);
    gl.vertexAttribPointer(
      attrLocation,
      attr.size,
      attr.type,
      attr.normalized,
      attr.stride,
      attr.offset
    );
    gl.enableVertexAttribArray(attrLocation);
  });
}

function clearCanvas(gl, color) {
  gl.clearColor(color.r, color.g, color.b, color.a);
  gl.clear(gl.COLOR_BUFFER_BIT);
}

/**
 * Given a canvas element, uses WebGL to draw objects on it
 * @param {!WebGLRenderingContext} gl The current WebGL rendering context
 * @param {string[]} shaderIds Array of ids names (no # prefix) of the script
 *        tags for the shaders. The first is assumed to be the
 *        vertex shader, the second the fragment shader. Default IDs are vertexShader
 *        and fragmentShader
 * @param {Float32Array} bufferData The data to transfer to the buffer
 * @param {Array<AttributeObject>} attributes An array of attribute info for the buffer data.
 * @param {ColorObject} clearColor The rgba color (values 0.0 to 1.0) to clear the canvas to; default is transparent 0,0,0
 * @throws {Error} if browser does not support WebGL
 */
export function drawCanvas(
  gl,
  bufferData = null,
  attributes = [],
  shaderIds = ["vertexShader", "fragmentShader"],
  clearColor = { r: 0.0, g: 0.0, b: 0.0, a: 0.0 }
) {
  // const gl = canvas.getContext("webgl");

  const program = makeProgramFromScripts(gl, shaderIds);

  //
  // Create buffer from buffer data and attributes
  //
  createBuffer(gl, program, bufferData, attributes);

  // Tell WebGL how to convert from clip space to pixels
  gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
  clearCanvas(gl, clearColor);

  gl.useProgram(program);

  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}