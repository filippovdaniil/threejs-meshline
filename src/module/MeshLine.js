import { Matrix4 } from 'three/src/math/Matrix4';
import { Geometry } from 'three/src/core/Geometry';
import { BufferGeometry } from 'three/src/core/BufferGeometry';
import { BufferAttribute } from 'three/src/core/BufferAttribute';

import { MeshLineRaycast } from './MeshLineRaycast';
import { memcpy } from './memcpy';


export class MeshLine extends BufferGeometry {
  constructor() {
    super();
    this.type = 'MeshLine';
    this.isMeshLine = true;

    this.positions = [];

    this.previous = [];
    this.next = [];
    this.side = [];
    this.width = [];
    this.indices_array = [];
    this.uvs = [];
    this.counters = [];
    this._vertices = [];
    this._bufferArray = [];

    this.widthCallback = null;

    // Used to raycast
    this.matrixWorld = new Matrix4();
    this.raycast = MeshLineRaycast.bind(this);
  }

  // to support previous api
  get geometry() {
    return this;
  }

  set geometry(value) {
    this.setFromGeometry(value);
  }

  get vertices() {
    return this._vertices;
  }

  set vertices(value) {
    this.setVertices(value);
  }

  get bufferArray() {
    return this._bufferArray;
  }

  set bufferyArray(value) {
    this.setBufferArray(value);
  }


  setMatrixWorld(matrixWorld) {
    this.matrixWorld = matrixWorld;
  }


  setFromGeometry(g, c) {
    if (g instanceof Geometry) {
      this.setVertices(g.vertices, c);
    }

    if (g instanceof BufferGeometry) {
      this.setBufferArray(g.getAttribute('position').array, c);
    }

    if (g instanceof Float32Array || g instanceof Array) {
      // to support previous api
      this.setBufferArray(g, c);
    }
  }


  // to support previous api
  setGeometry(g, c) {
    this.setFromGeometry(g, c);
  }


  setVertices(vts, wcb) {
    this._vertices = vts;
    this.widthCallback = wcb || this.widthCallback;
    this.positions = [];
    this.counters = [];

    for (let j = 0; j < vts.length; j++) {
      const v = vts[j];
      const c = j / vts.length;
      this.positions.push(v.x, v.y, v.z);
      this.positions.push(v.x, v.y, v.z);
      this.counters.push(c);
      this.counters.push(c);
    }

    this.process();
  }


  setBufferArray(ba, wcb) {
    this._bufferArray = ba;
    this.widthCallback = wcb || this.widthCallback;
    this.positions = [];
    this.counters = [];
    for (let j = 0; j < ba.length; j += 3) {
      const c = j / ba.length;
      this.positions.push(ba[j], ba[j + 1], ba[j + 2]);
      this.positions.push(ba[j], ba[j + 1], ba[j + 2]);
      this.counters.push(c);
      this.counters.push(c);
    }

    this.process();
  }


  compareV3(a, b) {
    const aa = a * 6;
    const ab = b * 6;

    return (
      this.positions[aa] === this.positions[ab] &&
      this.positions[aa + 1] === this.positions[ab + 1] &&
      this.positions[aa + 2] === this.positions[ab + 2]
    );
  }


  copyV3(a) {
    const aa = a * 6;
    return [this.positions[aa], this.positions[aa + 1], this.positions[aa + 2]];
  }


  process() {
    const l = this.positions.length / 6;

    this.previous = [];
    this.next = [];
    this.side = [];
    this.width = [];
    this.indices_array = [];
    this.uvs = [];

    let w;
    let v;

    // initial previous points
    if (this.compareV3(0, l - 1)) {
      v = this.copyV3(l - 2);
    } else {
      v = this.copyV3(0);
    }

    this.previous.push(v[0], v[1], v[2]);
    this.previous.push(v[0], v[1], v[2]);

    for (let j = 0; j < l; j++) {
      // sides
      this.side.push(1);
      this.side.push(-1);

      // widths
      w = this.widthCallback ? this.widthCallback(j / (l - 1)) : 1;

      this.width.push(w);
      this.width.push(w);

      // uvs
      this.uvs.push(j / (l - 1), 0);
      this.uvs.push(j / (l - 1), 1);

      if (j < l - 1) {
        // points previous to poisitions
        v = this.copyV3(j);
        this.previous.push(v[0], v[1], v[2]);
        this.previous.push(v[0], v[1], v[2]);

        // indices
        const n = j * 2;
        this.indices_array.push(n, n + 1, n + 2);
        this.indices_array.push(n + 2, n + 1, n + 3);
      }

      if (j > 0) {
        // points after poisitions
        v = this.copyV3(j);
        this.next.push(v[0], v[1], v[2]);
        this.next.push(v[0], v[1], v[2]);
      }
    }

    // last next point
    if (this.compareV3(l - 1, 0)) {
      v = this.copyV3(1);
    } else {
      v = this.copyV3(l - 1);
    }

    this.next.push(v[0], v[1], v[2]);
    this.next.push(v[0], v[1], v[2]);

    // redefining the attribute seems to prevent range errors
    // if the user sets a differing number of vertices
    if (!this._attributes || this._attributes.position.count !== this.positions.length) {
      this._attributes = {
        position: new BufferAttribute(new Float32Array(this.positions), 3),
        previous: new BufferAttribute(new Float32Array(this.previous), 3),
        next: new BufferAttribute(new Float32Array(this.next), 3),
        side: new BufferAttribute(new Float32Array(this.side), 1),
        width: new BufferAttribute(new Float32Array(this.width), 1),
        uv: new BufferAttribute(new Float32Array(this.uvs), 2),
        index: new BufferAttribute(new Uint16Array(this.indices_array), 1),
        counters: new BufferAttribute(new Float32Array(this.counters), 1),
      };
    } else {
      this._attributes.position.copyArray(new Float32Array(this.positions));
      this._attributes.position.needsUpdate = true;
      this._attributes.previous.copyArray(new Float32Array(this.previous));
      this._attributes.previous.needsUpdate = true;
      this._attributes.next.copyArray(new Float32Array(this.next));
      this._attributes.next.needsUpdate = true;
      this._attributes.side.copyArray(new Float32Array(this.side));
      this._attributes.side.needsUpdate = true;
      this._attributes.width.copyArray(new Float32Array(this.width));
      this._attributes.width.needsUpdate = true;
      this._attributes.uv.copyArray(new Float32Array(this.uvs));
      this._attributes.uv.needsUpdate = true;
      this._attributes.index.copyArray(new Uint16Array(this.indices_array));
      this._attributes.index.needsUpdate = true;
    }

    this.setAttribute('position', this._attributes.position);
    this.setAttribute('previous', this._attributes.previous);
    this.setAttribute('next', this._attributes.next);
    this.setAttribute('side', this._attributes.side);
    this.setAttribute('width', this._attributes.width);
    this.setAttribute('uv', this._attributes.uv);
    this.setAttribute('counters', this._attributes.counters);

    this.setIndex(this._attributes.index);

    this.computeBoundingSphere();
    this.computeBoundingBox();
  }


  /**
   * Fast method to advance the line by one position. The oldest position is removed.
   * @param position
   */
  advance(position) {
    var positions = this._attributes.position.array;
    var previous = this._attributes.previous.array;
    var next = this._attributes.next.array;
    const l = positions.length;

    // PREVIOUS
    memcpy(positions, 0, previous, 0, l);

    // POSITIONS
    memcpy(positions, 6, positions, 0, l - 6);

    positions[l - 6] = position.x;
    positions[l - 5] = position.y;
    positions[l - 4] = position.z;
    positions[l - 3] = position.x;
    positions[l - 2] = position.y;
    positions[l - 1] = position.z;

    // NEXT
    memcpy(positions, 6, next, 0, l - 6);

    next[l - 6] = position.x;
    next[l - 5] = position.y;
    next[l - 4] = position.z;
    next[l - 3] = position.x;
    next[l - 2] = position.y;
    next[l - 1] = position.z;

    this._attributes.position.needsUpdate = true;
    this._attributes.previous.needsUpdate = true;
    this._attributes.next.needsUpdate = true;
  }
}
