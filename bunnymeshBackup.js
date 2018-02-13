var screamLoaded=false,clackLoaded=false;
var waud=require('waud.js');
Waud.init();
var clack = new WaudSound("clack.mp3", { autoplay: false, loop: false, onload: function(){
  clackLoaded=true;
} });
var scream = new WaudSound("scream.mp3", { autoplay: false, loop: false, onload: function(){
  screamLoaded=true;
} });
//branch//
const regl = require('regl')()
const mat4 = require('gl-mat4')
const normals = require('angle-normals')
var radius = 4
var bunny = require('primitive-sphere')(radius, {
  segments: 16
});
var createCube = require('primitive-cube');
var board = createCube(200, 200, 1);
var pickRay = require('camera-picking-ray');
var intersect = require('ray-plane-intersection');
var lightradius = 20;
var turnstate = 0;

//
for(let i=0; i<board.positions.length; i++){
  board.positions[i][2]-=2;
}

for(let i=0; i<bunny.positions.length; i++){
  bunny.positions[i][2]*=0.5;
}

var goBoard=[];
for(let x=0; x<19; x++){
  goBoard[x]=new Array(19);
  goBoard[x].fill(undefined);
}
console.log('starting state of board',goBoard);


var pebs=[];
var order=1;
const GO_PIECE_BLACK=2;
const GO_PIECE_WHITE=1;
var currentPlayer=GO_PIECE_WHITE;

// new goPiece(player)
class goPiece{
  constructor(player,coord){
    console.log('piece added to board by',player==GO_PIECE_WHITE?'GO_PIECE_WHITE':'GO_PIECE_BLACK','at',coord);
    this.player=player;
    this.coord={x: coord[0],y:coord[1]};
    this.order=order++;
    this.currentLiberties=0;
  }

  getContext(){
    var sx=Math.max(this.coord.x-1,0),sy=Math.max(this.coord.y-1,0),
        ex=Math.min(this.coord.x+1,18),ey=Math.min(this.coord.y+1,18);
    var cover=((ex-sx+1)*(ey-sy+1))-1,neighbours=0;

    for(let dx=sx; dx<ex+1; dx++)
      for(let dy=sy; dy<ey+1; dy++)
        if(!(dx==this.coord.x && dy==this.coord.y)){
          if(goPiece.isOccupied(dx,dy))
            neighbours++;
        }

  return {liberties: cover-neighbours, cover: cover, neighbours: neighbours};
  }

  freeAndFriend(checkPlayer){
    if(checkPlayer.player==this.player && this.hasFreedom(checkPlayer))
      return true;
  return false
  }

  exclude(checkPlayer){
    return (typeof checkPlayer!='undefined' && checkPlayer.order==this.order);
  }

  hasFreedom(checkPlayer){
    const leftCell=[this.coord.x-1,this.coord.y],
          rightCell=[this.coord.x+1,this.coord.y],
          topCell=[this.coord.x,this.coord.y-1],
          bottomCell=[this.coord.x,this.coord.y+1];

    if(
      (this.coord.x<1 || goPiece.cannotEscape(leftCell,checkPlayer,this)) &&
      (this.coord.x>17 || goPiece.cannotEscape(rightCell,checkPlayer,this)) &&
      (this.coord.y<1 || goPiece.cannotEscape(topCell,checkPlayer,this)) &&
      (this.coord.y>17 || goPiece.cannotEscape(bottomCell,checkPlayer,this))
    )
      return false;
  return true;
  }
//
  static cannotEscape([x,y],checkPlayer,context)
  {
    return goPiece.isOccupied(x,y) && (goBoard[x][y].exclude(checkPlayer) || !goBoard[x][y].freeAndFriend(context));
  }

  static isOccupied(x,y){
    return typeof goBoard[x]!=='undefined' && typeof goBoard[x][y]!=='undefined';
  }

  isCaptured(){
    var cl=this.getContext();
    if(this.currentLiberties!==cl.liberties){
      this.currentLiberties=cl.liberties;
      console.log('liberties',this.coord,cl);
    }
    return !this.hasFreedom();
    //return (this.currentLiberties>0?1.0:0.5);
  }
}


const rowLen=21*4;
function updateBoard(){
  var boardData=[];
  for(let i=0; i<21*rowLen; i+=4){
    let col=(i%rowLen)/4,row=Math.floor(i/rowLen);
    let isBorder=col==0 || col==20 || row==0 || row==20;
    let isOccupied=!isBorder && goPiece.isOccupied(col-1,row-1);
    let isWhite=isOccupied && goBoard[col-1][row-1].player==GO_PIECE_WHITE;
    boardData[i]=isWhite?255:0;
    boardData[i+1]=isOccupied?(isWhite?255:0):255;
    boardData[i+2]=isOccupied?(isWhite?0:255):255;
    boardData[i+3]=255;
  }
return boardData;
}
// From a flat array
var boardTexture = regl.texture({
  width: 21,
  height: 21,
  data: updateBoard(),
  min: 'linear',
  mag: 'linear'
})

const drawBoard = regl({
  vert: `
  precision mediump float;
  attribute vec3 position, normal;
  attribute vec2 uv;
  uniform mat4 view, projection;
  varying vec3 fragNormal, fragPosition;
  varying vec2 fuv;
  void main() {
    fragNormal = normal;
    fragPosition = position;
    fuv = uv;
    gl_Position = projection * view * vec4(fragPosition, 1);
  }`,

  frag: `
  precision mediump float;
  struct Light {
    vec3 color;
    vec3 position;
  };
  uniform Light lights[4];
  uniform sampler2D bTexture;
  varying vec3 fragNormal, fragPosition;
  varying vec2 fuv;

  void main() {
    float boardWidth=20.0;
    vec3 normal = normalize(fragNormal);
    float line = fract(fuv.x*boardWidth)<0.05 || fract(fuv.y*boardWidth)<0.05 || fract(fuv.x*boardWidth)>0.95 || fract(fuv.y*boardWidth)>0.95?0.0:1.0; // *fract(fuv.y*10.0)>0.05);
    vec4 stateColor=texture2D(bTexture, vec2(fuv.x+0.025,fuv.y+0.025)*((1.0/21.0)*20.0));
    vec3 color = ((fuv.x*boardWidth)>0.95 && (fuv.x*boardWidth)<19.05 && (fuv.y*boardWidth)>0.95 && (fuv.y*boardWidth)<19.05?line:1.0)*stateColor.rgb;
    vec3 light = vec3(0, 0, 0);
    for (int i = 0; i < 4; ++i) {
      vec3 lightDir = normalize(lights[i].position - fragPosition);
      float diffuse = max(0.0, dot(lightDir, normal));
//      float postdiffuse = clamp(prediffuse,
      light += diffuse * lights[i].color*color;

    }
    gl_FragColor = vec4(light, 1);
//    float rangeColor = vec4(unclamped,0.5,10.0);
//    float unclamped=vec4(light,1);
//   gl_FragColor = vec4(rangeColor);
  }`,

  attributes: {
    position: board.positions,
    normal: normals(board.cells, board.positions),
    uv: board.uvs
  },

  elements: board.cells,

  uniforms: {
    bTexture: boardTexture,
    view: regl.prop('view'),
    projection: regl.prop('projection'),
    'lights[0].color': [0.75, 0.75, 0.75],
    'lights[1].color': [0.75, 0.75, 0.75],
    'lights[2].color': [0.75, 0.75, 0.75],
    'lights[3].color': [0.75, 0.75, 0.75],
    // 'lights[0].color': [1, 0, 0],
    // 'lights[1].color': [0, 1, 0],
    // 'lights[2].color': [0, 0, 1],
    // 'lights[3].color': [1, 1, 0],
    'lights[0].position': ({tick}) => {
      const t = 0.1 * tick
      return [
        lightradius * Math.cos(0.09 * (t)),
        lightradius * Math.sin(0.09 * (2 * t)),
        lightradius * Math.cos(0.09 * (3 * t))
      ]
    },
    'lights[1].position': ({tick}) => {
      const t = 0.1 * tick
      return [
        lightradius * Math.cos(0.05 * (5 * t + 1)),
        lightradius * Math.sin(0.05 * (4 * t)),
        lightradius * Math.cos(0.05 * (0.1 * t))
      ]
    },
    'lights[2].position': ({tick}) => {
      const t = 0.1 * tick
      return [
        lightradius * Math.cos(0.05 * (9 * t)),
        lightradius * Math.sin(0.05 * (0.25 * t)),
        lightradius * Math.cos(0.05 * (4 * t))
      ]
    },
    'lights[3].position': ({tick}) => {
      const t = 0.1 * tick
      return [
        lightradius * Math.cos(0.1 * (0.3 * t)),
        lightradius * Math.sin(0.1 * (2.1 * t)),
        lightradius * Math.cos(0.1 * (1.3 * t))
      ]
    }
  }
})

const drawBunny = regl({
  vert: `
  precision mediump float;
  attribute vec3 position, normal;
  uniform mat4 view, projection;
  uniform vec2 pos;
  uniform float scale;
  varying vec3 fragNormal, fragPosition;
  void main() {
    fragNormal = normal;
    fragPosition = position*scale;
    fragPosition.xy +=pos*1.0;
    gl_Position = projection * view * vec4(fragPosition, 1);
  }`,

  frag: `
  precision mediump float;
  struct Light {
    vec3 color;
    vec3 position;
  };
  uniform Light lights[4];
  varying vec3 fragNormal, fragPosition;
  uniform float color;

  void main() {
    vec3 normal = normalize(fragNormal);
    vec3 light = vec3(0, 0, 0);
    for (int i = 0; i < 4; ++i) {
      vec3 lightDir = normalize(lights[i].position - fragPosition);
      float diffuse = max(0.0, dot(lightDir, normal));
      light += diffuse * lights[i].color*color;
    }
    gl_FragColor = vec4(light,1);
  }`,

  attributes: {
    position: bunny.positions,
    normal: normals(bunny.cells, bunny.positions)
  },

  elements: bunny.cells,

  uniforms: {
    scale: regl.prop('scale'),
    color: regl.prop('color'),
    pos: regl.prop('pos'),
    view: regl.prop('view'),
    projection: regl.prop('projection'),
    'lights[0].color': [0.75, 0.75, 0.75],
    'lights[1].color': [0.75, 0.75, 0.75],
    'lights[2].color': [0.75, 0.75, 0.75],
    'lights[3].color': [0.75, 0.75, 0.75],
    'lights[0].position': ({tick}) => {
      const t = 0.1 * tick
      return [
        lightradius * Math.cos(0.09 * (t)),
        lightradius * Math.sin(0.09 * (2 * t)),
        lightradius * Math.cos(0.09 * (3 * t))
      ]
    },
    'lights[1].position': ({tick}) => {
      const t = 0.1 * tick
      return [
        lightradius * Math.cos(0.05 * (5 * t + 1)),
        lightradius * Math.sin(0.05 * (4 * t)),
        lightradius * Math.cos(0.05 * (0.1 * t))
      ]
    },
    'lights[2].position': ({tick}) => {
      const t = 0.1 * tick
      return [
        lightradius * Math.cos(0.05 * (9 * t)),
        lightradius * Math.sin(0.05 * (0.25 * t)),
        lightradius * Math.cos(0.05 * (4 * t))
      ]
    },
    'lights[3].position': ({tick}) => {
      const t = 0.1 * tick
      return [
        lightradius * Math.cos(0.1 * (0.3 * t)),
        lightradius * Math.sin(0.1 * (2.1 * t)),
        lightradius * Math.cos(0.1 * (1.3 * t))
      ]
    }
  }
})

var mposition=[0,0],cx=[0,0],newPos=undefined,pauseGame=false;
require('touches')().on('end', function (ev, [x,y]) {
    if(pauseGame)
      return;
    for(let bx=0; bx<19; bx++)
      for(let by=0; by<19; by++){
        // for each piece, bx for the row, by for the column | goBoard is the 2d array
        if(typeof goBoard[bx][by]!='undefined'){// square has a piece
          //goBoard[bx][by].hasPiece()
          // if(goBoard[bx+1][by]){
          //   console.log(bx+':'+by,'has a piece to the right of it');
          // }
          // if(goBoard[bx+1][by+1]){
          //   console.log(bx+':'+by,'has a piece diagonally NW of it');
          // }
        }
      }

//goBoard=[


    if(mouseDragging && typeof newPos!=='undefined' && typeof goBoard[newPos[0]][newPos[1]]=='undefined'){
      goBoard[newPos[0]][newPos[1]]=new goPiece(currentPlayer,[newPos[0],newPos[1]]);
      // let rx=Math.round(Math.random()*18),ry=Math.round(Math.random()*18);
      // goBoard[rx][ry]=new goPiece(GO_PIECE_BLACK,[rx,ry]);
      pauseGame=true;

      var deathList=[];


      for(let x=0; x<18; x++)
        for(let y=0; y<18; y++)
          if(typeof goBoard[x][y]!='undefined' && goBoard[x][y].isCaptured()){
            if(x==newPos[0] && y==newPos[1]){
              console.log('illegal move');
              goBoard[x][y]=undefined;
              pauseGame=false;
              mouseDragging=false;
              return;
            }
            console.log('piece added to death list :>',goBoard[x][y]);
            deathList.push(goBoard[x][y]);
          }
      if(deathList.length){
        if(screamLoaded)
          scream.play();
        console.log('removing pieces',deathList);
        deathList.forEach(function(gp){
          goBoard[gp.coord.x][gp.coord.y]=undefined;
        });
      }

      boardTexture.subimage({data: updateBoard()});

      setTimeout(function(){
        currentPlayer=(currentPlayer==GO_PIECE_BLACK?GO_PIECE_WHITE:GO_PIECE_BLACK);
        console.log('play next move');
        pauseGame=false;
      },1000);

      if(clackLoaded)
        clack.play();
    }
    mouseDragging=false;
  }).on('start',function(ev,[x,y]){
    if(pauseGame)
      return false;
    mouseDragging=true;
  }).on('move',function(ev,[x,y]){
    if(pauseGame)
      return;
    mposition=[((x/window.innerWidth)*200)-100,((1-(y/window.innerHeight))*200)-100];

    var projection = camera.projection;
    var view = camera.view;
    var projView = mat4.multiply([], projection, view)
    var invProjView = mat4.invert([], projView)

    var mouse = [ x, y ];
    var viewport = [ 0, 0, window.innerWidth, window.innerHeight ];

    var ray = {
      ro: [0, 0, 0],
      rd: [0, 0, 0]
    }

    //store result in ray (origin, direction)
    pickRay(ray.ro, ray.rd, mouse, viewport, invProjView);

    //let's see if the mouse hit a 3D sphere...
     var normal = [0, 0, 1]
     var distance = 0
    var hit = intersect([], ray.ro, ray.rd, normal, distance)

    if (hit) {
    //  console.log("Mouse hit the sphere at:", hit);
      //cx=[Math.round(hit[0]/10)*10-5,Math.round(hit[1]/10)*10-5];
      cx=[(Math.round(hit[0]/10))+9,(Math.round(hit[1]/10))+9];
      if(cx[0]>=0 && cx[0]<19 && cx[1]>=0 && cx[1]<19)
        newPos=cx;
      else {
        newPos=undefined;
      }
    }


});

  var mouseDragging=false;

  var camera={};

regl.frame(({tick, viewportWidth, viewportHeight}) => {
  regl.clear({
    depth: 1,
    color: [0, 0, 0, 1]
  });
  const t=(3.14159265/2);

   camera={
    view: mat4.lookAt([],
      [300 * Math.cos(t), 0, 300 * Math.sin(t)],
      [0, 2.5, 0],
      [0, 1, 0]),
    projection: mat4.perspective([],
      Math.PI / 4,
      viewportWidth / viewportHeight,
      0.01,
      1000)
  };
  drawBoard({
    view: camera.view,
    projection: camera.projection
  });
  var implicitPebs=goBoard.reduce(function(totalList,cR,cRow){ // current row and current row index
    return totalList.concat(
      cR.reduce(function(cList,cSqr,cCol){
      //  console.log('cr',cRow,'cc',cCol);
        if(typeof cSqr!='undefined')
          cList.push({
            view: camera.view,
            projection: camera.projection,
            color: cSqr.player==GO_PIECE_WHITE?1.0:0.25,
            scale: 1,
            pos: [(cRow*10)-90,(cCol*10)-90]
          });
      return cList;
      },[])
    );
  },[]);
  drawBunny(implicitPebs);
  if(!pauseGame && mouseDragging && typeof newPos!='undefined'){
    drawBunny({
      scale: 1.2,
      view: camera.view,
      projection: camera.projection,
      color: currentPlayer==GO_PIECE_WHITE?1.0:0.25,
      pos: [(cx[0]*10)-90,(cx[1]*10)-90]
    })
  }
})
