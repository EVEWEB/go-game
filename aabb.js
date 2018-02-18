const regl = require('regl')()
const cols = 100;

regl({
  frag: `
    precision mediump float;
    uniform vec4 color;
    void main() {
      gl_FragColor = color;

    }`,

  vert: `
    precision mediump float;
    attribute vec2 position;
    void main() {
      gl_Position = vec4(position, 0, 1);
    }`,

  attributes: {
    position: ((new Array(cols).fill(2).map((v,i)=>i%10).map((v,i)=>[v,Math.floor(i/10)])))

//1: Array [ 1, 0 ] 2: Array [ 2, 0 ] 3: Array [ 3, 0 ] 4: Array [ 4, 0 ] 5: Array [ 5, 0 ] 6: Array [ 6, 0 ] 7: Array [ 7, 0 ] 8: Array [ 8, 0 ] 9: Array [ 9, 0 ] 10: Array [ 0, 1
      //new Array(cols).fill(2).map((v,i)=>cols%i).map((v,i)=>[v,Math.floor(i/cols)-v]))
  },

//eg. []
  uniforms: {
    color: [1, 1, 0, 1]
  },

 elements: (new Array(cols).fill(2).map((x, i) => [i*10%cols,i+1*10%cols])),

  lineWidth: 100,
  count: 10

})();
