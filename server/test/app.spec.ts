import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { INestApplication, ValidationPipe, BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { ApiExceptionFilter } from '../src/api-exception.filter';

const dir = mkdtempSync(join(tmpdir(), 'familytree-'));
process.env.DATABASE_PATH = join(dir, 'test.sqlite');
process.env.SESSION_SECRET = 'test-session-secret-must-be-32b-long';
process.env.BOOTSTRAP_USERNAME = 'zhang';
process.env.BOOTSTRAP_PASSWORD = 'password1';
process.env.NODE_ENV = 'test';
process.env.COOKIE_SECURE = 'false';
delete process.env.STATIC_DIR;

describe('familytree api', () => {
  let app: INestApplication;
  let cookie = '';

  before(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        exceptionFactory: () => new BadRequestException({ error: '提交的内容无法识别' }),
      }),
    );
    app.useGlobalFilters(new ApiExceptionFilter());
    await app.init();
  });

  after(async () => {
    await app.close();
  });

  const agent = () => request(app.getHttpServer());

  function cookieFrom(response: request.Response) {
    const raw = response.headers['set-cookie'];
    const value = Array.isArray(raw) ? raw[0] : raw;
    assert.ok(value);
    return value.split(';')[0];
  }

  it('allows health without a session and hides the tree', async () => {
    const health = await agent().get('/api/health');
    assert.equal(health.status, 200);
    assert.deepEqual(health.body, { ok: true });
    const tree = await agent().get('/api/tree');
    assert.equal(tree.status, 401);
  });

  it('rejects a wrong password and locks the address', async () => {
    const ip = '203.0.113.10';
    for (let i = 0; i < 8; i += 1) {
      const response = await agent()
        .post('/api/session')
        .set('X-Familytree', '1')
        .set('X-Forwarded-For', ip)
        .send({ username: 'zhang', password: 'nope-nope' });
      assert.equal(response.status, 401);
      assert.deepEqual(response.body, { error: '账号或密码不正确' });
    }
    const locked = await agent()
      .post('/api/session')
      .set('X-Familytree', '1')
      .set('X-Forwarded-For', ip)
      .send({ username: 'zhang', password: 'password1' });
    assert.equal(locked.status, 429);
  });

  it('logs in, reads the tree, and logs out', async () => {
    const login = await agent()
      .post('/api/session')
      .set('X-Familytree', '1')
      .set('X-Forwarded-For', '203.0.113.20')
      .send({ username: 'zhang', password: 'password1' });
    assert.equal(login.status, 204);
    cookie = cookieFrom(login);
    const tree = await agent().get('/api/tree').set('Cookie', cookie);
    assert.equal(tree.status, 200);
    assert.equal(
      tree.body.persons.some((person: { name: string }) => person.name === '张尔寿'),
      true,
    );
    const logout = await agent().delete('/api/session').set('X-Familytree', '1').set('Cookie', cookie);
    assert.equal(logout.status, 204);
    const again = await agent().get('/api/tree').set('Cookie', cookie);
    assert.equal(again.status, 401);
    const relogin = await agent()
      .post('/api/session')
      .set('X-Familytree', '1')
      .set('X-Forwarded-For', '203.0.113.21')
      .send({ username: 'zhang', password: 'password1' });
    cookie = cookieFrom(relogin);
  });

  it('creates a person with no parents', async () => {
    const created = await agent()
      .post('/api/persons')
      .set('X-Familytree', '1')
      .set('Cookie', cookie)
      .send({ name: '新的根', parents: [], marriages: [] });
    assert.equal(created.status, 201);
    assert.equal(created.body.name, '新的根');
    const tree = await agent().get('/api/tree').set('Cookie', cookie);
    const person = tree.body.persons.find((item: { name: string }) => item.name === '新的根');
    assert.ok(person);
    assert.equal(
      tree.body.parents.some((link: { childId: number }) => link.childId === person.id),
      false,
    );
  });

  it('rejects a cycle and keeps the previous links', async () => {
    const parent = await agent()
      .post('/api/persons')
      .set('X-Familytree', '1')
      .set('Cookie', cookie)
      .send({ name: '甲', parents: [], marriages: [] });
    const child = await agent()
      .post('/api/persons')
      .set('X-Familytree', '1')
      .set('Cookie', cookie)
      .send({
        name: '乙',
        parents: [{ personId: parent.body.id, role: 'father', sortOrder: 0 }],
        marriages: [],
      });
    const beforeTree = await agent().get('/api/tree').set('Cookie', cookie);
    const cycled = await agent()
      .patch(`/api/persons/${parent.body.id}`)
      .set('X-Familytree', '1')
      .set('Cookie', cookie)
      .send({
        name: '甲',
        parents: [{ personId: child.body.id, role: 'father', sortOrder: 0 }],
        marriages: [],
      });
    assert.equal(cycled.status, 409);
    assert.deepEqual(cycled.body, { error: '这样会把祖先收成自己的后代' });
    const afterTree = await agent().get('/api/tree').set('Cookie', cookie);
    const linksOf = (body: { parents: { childId: number; parentId: number }[] }) =>
      body.parents
        .filter((link) => link.childId === parent.body.id || link.childId === child.body.id)
        .map((link) => `${link.childId}:${link.parentId}`)
        .sort();
    assert.deepEqual(linksOf(afterTree.body), linksOf(beforeTree.body));
  });

  it('keeps children when their parent is deleted', async () => {
    const parent = await agent()
      .post('/api/persons')
      .set('X-Familytree', '1')
      .set('Cookie', cookie)
      .send({ name: '要删除的根', parents: [], marriages: [] });
    const child = await agent()
      .post('/api/persons')
      .set('X-Familytree', '1')
      .set('Cookie', cookie)
      .send({
        name: '留下来的子女',
        parents: [{ personId: parent.body.id, role: 'father', sortOrder: 0 }],
        marriages: [],
      });
    const removed = await agent()
      .delete(`/api/persons/${parent.body.id}`)
      .set('X-Familytree', '1')
      .set('Cookie', cookie);
    assert.equal(removed.status, 204);
    const tree = await agent().get('/api/tree').set('Cookie', cookie);
    assert.equal(tree.body.persons.some((person: { id: number }) => person.id === child.body.id), true);
    assert.equal(tree.body.persons.some((person: { id: number }) => person.id === parent.body.id), false);
    assert.equal(
      tree.body.parents.some(
        (link: { childId: number; parentId: number }) =>
          link.childId === child.body.id && link.parentId === parent.body.id,
      ),
      false,
    );
  });

  it('returns the representative ages', async () => {
    const samples = [
      ['1900.2.18', '1963.4.7', 63, 1900, true],
      ['1945 年', null, 81, 1945, false],
      ['1868年8月12日', '1951年3月29日', 82, 1868, true],
      ['正月十九', null, null, null, false],
      ['十一月初八', '四月十二', null, null, true],
      ['1958.4.7', null, 68, 1958, false],
      ['2020.12.1', '2020.1.1', null, 2020, true],
    ] as const;
    for (const [birthText, deathText, age, birthYear, deceased] of samples) {
      const created = await agent()
        .post('/api/persons')
        .set('X-Familytree', '1')
        .set('Cookie', cookie)
        .send({ name: `年龄${birthText}`, birthText, deathText, parents: [], marriages: [] });
      assert.equal(created.status, 201);
      assert.equal(created.body.age, age);
      assert.equal(created.body.birthYear, birthYear);
      assert.equal(created.body.deceased, deceased);
      const detail = await agent().get(`/api/persons/${created.body.id}`).set('Cookie', cookie);
      assert.equal(detail.body.age, age);
      assert.equal(Object.prototype.hasOwnProperty.call(detail.body, 'age'), true);
    }
  });
});
