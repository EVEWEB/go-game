var screamLoaded=false,clackLoaded=false;
var waud=require('waud.js');
Waud.init();
var clack = new WaudSound("clack.mp3", { autoplay: false, loop: false, onload: function(){
  clackLoaded=true;
} });
var scream = new WaudSound("scream.mp3", { autoplay: false, loop: false, onload: function(){
  screamLoaded=true;
} });

const regl = require('regl')();
const mat4 = require('gl-mat4');
const normals = require('angle-normals');
var radius = 4;
var bunny = require('primitive-sphere')(radius, {
  segments: 16
});
var createCube = require('primitive-cube');
var board = createCube(200, 200, 1);
var pickRay = require('camera-picking-ray');
var intersect = require('ray-plane-intersection');
var lightradius = 20;
var turnstate = 0;
var aabb = require('aabb-2d');
//var glsl = require('glslify');


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
    //this.influence=influence++;
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


  freeAndFriend(player,checkPlayer){
    if(this.exclude(checkPlayer))
      return false;
    if(player==this.player && this.hasFreedom(checkPlayer))
      return true;
  return false
  }


  exclude(checkPlayer){
    return (typeof checkPlayer!='undefined' && checkPlayer.indexOf(this.coord)!=-1);
  }

  hasFreedom(checkPlayer){
    //console.log('hasFreedom',checkPlayer,this.order);
    if(typeof checkPlayer!=='undefined'){
    //  console.log('+','child query');
      checkPlayer.push(this.coord);
    }
    else {
      //console.log('-','root query');
      checkPlayer=[this.coord];
    }
    const leftCell=[this.coord.x-1,this.coord.y],
          rightCell=[this.coord.x+1,this.coord.y],
          topCell=[this.coord.x,this.coord.y+1],
          bottomCell=[this.coord.x,this.coord.y-1],
          trCell=[this.coord.x+1,this.coord.y+1],
          tlCell=[this.coord.x-1,this.coord.y+1],
          brCell=[this.coord.x+1,this.coord.y-1],
          blCell=[this.coord.x-1,this.coord.y-1];

    const left_block=goPiece.cannotEscape(leftCell,this.player,checkPlayer),
          right_block=goPiece.cannotEscape(rightCell,this.player,checkPlayer),
          top_block=goPiece.cannotEscape(topCell,this.player,checkPlayer),
          bottom_block=goPiece.cannotEscape(bottomCell,this.player,checkPlayer),
          tr_block=goPiece.cannotEscape(trCell,this.player,checkPlayer),
          tl_block=goPiece.cannotEscape(tlCell,this.player,checkPlayer),
          bl_block=goPiece.cannotEscape(blCell,this.player,checkPlayer),
          br_block=goPiece.cannotEscape(brCell,this.player,checkPlayer);
    const lookupKey=['-',(this.player!=GO_PIECE_BLACK?'B':'W'),'#'];

    var blockCheck=left_block>0 &&
                    right_block>0 &&
                    top_block>0 &&
                    bottom_block>0;
          console.log('hasFreedom','['+this.coord.x+','+this.coord.y+']',!blockCheck);
          console.log(lookupKey[tl_block]+' '+lookupKey[top_block]+' '+lookupKey[tr_block]);
          console.log(lookupKey[left_block]+' '+(this.player==GO_PIECE_BLACK?'B':'W')+' '+lookupKey[right_block]);
          console.log(lookupKey[bl_block]+' '+lookupKey[bottom_block]+' '+lookupKey[br_block]);

  return !blockCheck;
  }

  static cannotEscape([x,y],player,checkPlayer)
  {
    if(x<0 || x>18 || y<0 || y>18)
      return 2;
    //console.log('cannotEscape',arguments);
    return (goPiece.isOccupied(x,y) && !goBoard[x][y].freeAndFriend(player,checkPlayer)?1:0);
  }
//2
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

//group.isCaptured()

const rowLen=21*4;
function updateBoard(){
  var boardData=[];
  var whiteBoxes=undefined,blackBoxes=undefined;
  for(let i=0; i<21*rowLen; i+=4){
    let col=(i%rowLen)/4,row=Math.floor(i/rowLen);
    let isBorder=(col==0 || col==20 || row==0 || row==20);
    let isOccupied=!isBorder && goPiece.isOccupied(col-1,row-1);
    let isWhite=isOccupied && goBoard[col-1][row-1].player==GO_PIECE_WHITE;
    if(isOccupied){
      var aabbGoPiece=aabb([col-1,row-1],[1,1]);
      if(isWhite){
        if(typeof whiteBoxes=='undefined'){
          whiteBoxes=aabbGoPiece;
        }else{
          whiteBoxes=whiteBoxes.expand(aabbGoPiece);
        }
        // add to white bounding box
      }else{
        if(typeof blackBoxes=='undefined'){
          blackBoxes=aabbGoPiece;
        }else{
          blackBoxes=blackBoxes.expand(aabbGoPiece);
        }
        // add to black bounding box
      }
    }
    boardData[i+3]=255;
  }
  for(let i=0; i<21*rowLen; i+=4){
    let col=(i%rowLen)/4,row=Math.floor(i/rowLen);
    boardData[i]=255;
    boardData[i+1]=255;
    boardData[i+2]=255;

    if(col==0 || col==20 || row==0 || row==20){
      continue;
    }
    let sx=col-1;
    let sy=row-1;
    if(typeof blackBoxes!=='undefined' && (blackBoxes.x0()<=sx && blackBoxes.y0()<=sy && blackBoxes.x1()>sx && blackBoxes.y1()>sy)){
      boardData[i]=0;
      boardData[i+1]=255;
      boardData[i+2]+=100;
    }
    if(typeof whiteBoxes!=='undefined' && (whiteBoxes.x0()<=sx && whiteBoxes.y0()<=sy && whiteBoxes.x1()>sx && whiteBoxes.y1()>sy)){
      boardData[i]=255;
      boardData[i+1]=0;
      boardData[i+2]+=100;
    }
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
      light += diffuse * lights[i].color*color;

    }
    gl_FragColor = vec4(light, 1);

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
    'lights[0].color': [1.0,1.0,1.0],
    'lights[1].color': [1.0,1.0,1.0],
    'lights[2].color': [1.0,1.0,1.0],
    'lights[3].color': [1.0,1.0,1.0],
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
        lightradius * Math.cos(0.05 * (2.0 * t))
      ]
    },
    'lights[2].position': ({tick}) => {
      const t = 0.1 * tick
      return [
        lightradius * Math.cos(0.05 * (9 * t)),
        lightradius * Math.sin(0.05 * (2.0 * t)),
        lightradius * Math.cos(0.05 * (4 * t))
      ]
    },
    'lights[3].position': ({tick}) => {
      const t = 0.1 * tick
      return [
        lightradius * Math.cos(0.1 * (2.0 * t)),
        lightradius * Math.sin(0.1 * (2.1 * t)),
        lightradius * Math.cos(0.1 * (2.3 * t))
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

    if(mouseDragging && typeof newPos!=='undefined' && typeof goBoard[newPos[0]][newPos[1]]=='undefined'){
      goBoard[newPos[0]][newPos[1]]=new goPiece(currentPlayer,[newPos[0],newPos[1]]);
      // let rx=Math.round(Math.random()*18),ry=Math.round(Math.random()*18);
      // goBoard[rx][ry]=new goPiece(GO_PIECE_BLACK,[rx,ry]);
      pauseGame=true;

      var deathList=[];


      for(let x=0; x<19; x++)
        for(let y=0; y<19; y++)
          if(typeof goBoard[x][y]!=='undefined' && goBoard[x][y].isCaptured()){
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
     var distance = 1
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

  var implicitPebs=goBoard.reduce(function(totalList,cR,cRow){ // Current row and current row index
    return totalList.concat(
      cR.reduce(function(cList,cSqr,cCol){
        if(typeof cSqr!='undefined') // First, check: spot undefined?
          cList.push({
            view: camera.view,
            projection: camera.projection,
            color: cSqr.player==GO_PIECE_WHITE?1.0:0.25, // If yes, make color mine.  cSqr.player is LOCAL SCOPE
            scale: 1,
            pos: [(cRow*10)-90,(cCol*10)-90] // Save pos to cList (cRow,cCol)
          });
      return cList;
      },[])
    );
  },[]);

  drawBunny(implicitPebs);

  if(!pauseGame && mouseDragging && typeof newPos!='undefined'){ // Conditions for drawing counter as planned
    drawBunny({
      scale: 1.2,
      view: camera.view,
      projection: camera.projection,
      color: currentPlayer==GO_PIECE_WHITE?1.0:0.25, // CurrentPlayer is for drawing
      pos: [(cx[0]*10)-90,(cx[1]*10)-90]
    })
  }
})
