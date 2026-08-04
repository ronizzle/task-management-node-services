import http from 'node:http';
import jwt from 'jsonwebtoken';
import { io as ioClient } from 'socket.io-client';
import { initSocket, broadcastToRoom, _resetForTests } from '../src/realtime/socket.js';

const JWT_SECRET = process.env.JWT_SECRET;

describe('Socket.IO realtime layer', () => {
  let httpServer;
  let port;

  beforeEach(async () => {
    _resetForTests();
    httpServer = http.createServer();
    initSocket(httpServer);
    await new Promise((resolve) => httpServer.listen(0, resolve));
    port = httpServer.address().port;
  });

  afterEach(async () => {
    _resetForTests();
    await new Promise((resolve) => httpServer.close(resolve));
  });

  function connect(token) {
    return ioClient(`http://localhost:${port}`, {
      auth: { token },
      transports: ['websocket'],
      reconnection: false,
    });
  }

  it('rejects a connection with no token', (done) => {
    const client = connect(undefined);
    client.on('connect_error', (err) => {
      expect(err.message).toBe('Unauthenticated');
      client.close();
      done();
    });
  });

  it('rejects a connection with an invalid token', (done) => {
    const client = connect('not-a-real-token');
    client.on('connect_error', (err) => {
      expect(err.message).toBe('Unauthenticated');
      client.close();
      done();
    });
  });

  it('accepts a connection with a valid JWT signed with the shared secret', (done) => {
    const token = jwt.sign({ sub: 7 }, JWT_SECRET, { algorithm: 'HS256' });
    const client = connect(token);

    client.on('connect', () => {
      expect(client.connected).toBe(true);
      client.close();
      done();
    });

    client.on('connect_error', (err) => done(err));
  });

  it('delivers a broadcastToRoom event only to sockets that joined that room', (done) => {
    const token = jwt.sign({ sub: 1 }, JWT_SECRET, { algorithm: 'HS256' });
    const memberClient = connect(token);
    const outsiderClient = connect(token);

    let memberReceived = false;

    memberClient.on('connect', () => {
      memberClient.emit('join:task', 42);

      setTimeout(() => {
        broadcastToRoom('task:42', 'task_updated', { status: 'in_progress' });
      }, 50);
    });

    memberClient.on('task_updated', (payload) => {
      memberReceived = true;
      expect(payload).toEqual({ status: 'in_progress' });
    });

    outsiderClient.on('task_updated', () => {
      done(new Error('outsider should not have received the event'));
    });

    setTimeout(() => {
      expect(memberReceived).toBe(true);
      memberClient.close();
      outsiderClient.close();
      done();
    }, 200);
  });
});
