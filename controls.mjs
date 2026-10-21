// Standard browser Gamepad mapping: bottom face button = A, right = B.
export function readPad(pad) {
  const empty = { x:0, y:0, a:false, b:false, start:false, connected:false };
  if (!pad || pad.connected === false || pad.mapping !== 'standard') return empty;
  const pressed = i => Boolean(pad.buttons?.[i]?.pressed);
  const axis = i => {
    const value = pad.axes?.[i] ?? 0;
    return Number.isFinite(value) && Math.abs(value) > 0.2 ? Math.sign(value)*(Math.min(1,Math.abs(value))-0.2)/0.8 : 0;
  };
  let x = (pressed(15)?1:0)-(pressed(14)?1:0);
  let y = (pressed(13)?1:0)-(pressed(12)?1:0);
  if (!x && !y) { x=axis(0); y=axis(1); }
  const length = Math.max(1,Math.hypot(x,y));
  return {x:x/length,y:y/length,a:pressed(0),b:pressed(1),start:pressed(9),connected:true};
}


export function joystickVector(clientX,clientY,rect) {
  const radius = Math.max(1,Math.min(rect.width,rect.height)*0.3);
  const dx=clientX-rect.left-rect.width/2, dy=clientY-rect.top-rect.height/2;
  const distance=Math.hypot(dx,dy), travel=Math.min(distance,radius);
  const directionX=distance?dx/distance:0, directionY=distance?dy/distance:0;
  const strength=Math.max(0,(travel/radius-0.12)/0.88);
  return { x:directionX*strength, y:directionY*strength, offsetX:directionX*travel, offsetY:directionY*travel };
}

export function cameraFrame(width,height,player,columns,rows) {
  width=Math.max(1,width);height=Math.max(1,height);
  const cellSize=Math.max(60,width/columns,height/rows);
  const worldWidth=columns*cellSize,worldHeight=rows*cellSize;
  const x=Math.max(0,Math.min(worldWidth-width,(player.x+0.5)*cellSize-width/2));
  const y=Math.max(0,Math.min(worldHeight-height,(player.y+0.5)*cellSize-height/2));
  return {worldWidth,worldHeight,x,y,cellSize};
}
