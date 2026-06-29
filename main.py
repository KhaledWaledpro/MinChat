from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles

app = FastAPI()

# ربط المجلد الاستاتيكي لقراءة ملفات الـ CSS والـ JS
app.mount("/static", StaticFiles(directory="static"), name="static")

waiting_users = []
active_connections = {}

@app.get("/")
async def get():
    with open("templates/index.html", "r", encoding="utf-8") as f:
        return HTMLResponse(content=f.read())

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    
    if waiting_users:
        peer = waiting_users.pop(0)
        active_connections[websocket] = peer
        active_connections[peer] = websocket
        
        await websocket.send_json({"type": "match", "role": "answer"})
        await peer.send_json({"type": "match", "role": "offer"})
    else:
        waiting_users.append(websocket)
        await websocket.send_json({"type": "waiting"})

    try:
        while True:
            data = await websocket.receive_json()
            peer = active_connections.get(websocket)
            if peer:
                await peer.send_json(data)
    except WebSocketDisconnect:
        if websocket in waiting_users:
            waiting_users.remove(websocket)
        peer = active_connections.get(websocket)
        if peer:
            try:
                await peer.send_json({"type": "peer_disconnected"})
            except:
                pass
            if peer in active_connections:
                del active_connections[peer]
        if websocket in active_connections:
            del active_connections[websocket]
