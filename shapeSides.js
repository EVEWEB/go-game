

const regl = require('regl')()
const oneFullRotationInRadians=(2.0 * Math.PI);
const fortyFiveDegrees=oneFullRotationInRadians/8; //360 in radians is PI*2, 360/8=45....
var numberOfSides=-3;

setInterval(()=>{
  numberOfSides=3+(numberOfSides+3)%(3*5000);
  regl.clear({
    color: [0, 0, 0, 1],
    depth: 1
  })
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
        gl_Position = vec4(position*0.5, 0, 1);
      }`,

    attributes: {

        position: (new Array(100).fill(2).map((v,i)=>i%10).map((v,i)=>[v,Math.floor(i/10)]))

//      position: (new Array(numberOfSides)).fill().map((x, i) => {
//        let theta = oneFullRotationInRadians * (i / numberOfSides); // difference in rotation? 1/4 [0=>0/4=0,1=>1/4=0.25,2=>2/4=0.5,3=>3/4=0.75]
//        let offsetRotation=0;
//        return [ Math.sin(theta+offsetRotation), Math.cos(theta*2.0) ];
//      })
  },

    uniforms: {
      color: [1, 0, 0, 1]
    },

    elements: (new Array(numberOfSides)).fill(2).map((x, i) => [i%numberOfSides,(i+1)%numberOfSides]),
    lineWidth: 3
  })();
},10);
