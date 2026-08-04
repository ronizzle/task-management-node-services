import jwt from 'jsonwebtoken';
import { jest } from '@jest/globals';
import { authenticateJwt, requireAdminOrManager } from '../src/middleware/auth.js';
import { authenticateInternalToken } from '../src/middleware/internalToken.js';

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('authenticateJwt', () => {
  it('rejects requests with no Authorization header', () => {
    const req = { headers: {} };
    const res = mockRes();
    const next = jest.fn();

    authenticateJwt(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects a token signed with the wrong secret', () => {
    const badToken = jwt.sign({ sub: '1' }, 'wrong-secret');
    const req = { headers: { authorization: `Bearer ${badToken}` } };
    const res = mockRes();
    const next = jest.fn();

    authenticateJwt(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('accepts a token signed with the shared JWT_SECRET and attaches userId', () => {
    const token = jwt.sign({ sub: '42' }, process.env.JWT_SECRET, { algorithm: 'HS256' });
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = mockRes();
    const next = jest.fn();

    authenticateJwt(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.userId).toBe('42');
    expect(req.token).toBe(token);
  });
});

describe('requireAdminOrManager', () => {
  it('rejects a team_member', () => {
    const req = { currentUser: { role: 'team_member' } };
    const res = mockRes();
    const next = jest.fn();

    requireAdminOrManager(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('allows an admin', () => {
    const req = { currentUser: { role: 'admin' } };
    const res = mockRes();
    const next = jest.fn();

    requireAdminOrManager(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it('allows a manager', () => {
    const req = { currentUser: { role: 'manager' } };
    const res = mockRes();
    const next = jest.fn();

    requireAdminOrManager(req, res, next);

    expect(next).toHaveBeenCalled();
  });
});

describe('authenticateInternalToken', () => {
  it('rejects a missing token', () => {
    const req = { headers: {} };
    const res = mockRes();
    const next = jest.fn();

    authenticateInternalToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('rejects an incorrect token', () => {
    const req = { headers: { 'x-internal-token': 'wrong' } };
    const res = mockRes();
    const next = jest.fn();

    authenticateInternalToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('accepts the correct shared token', () => {
    const req = { headers: { 'x-internal-token': process.env.INTERNAL_SERVICE_TOKEN } };
    const res = mockRes();
    const next = jest.fn();

    authenticateInternalToken(req, res, next);

    expect(next).toHaveBeenCalled();
  });
});
