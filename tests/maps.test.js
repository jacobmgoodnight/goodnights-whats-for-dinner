const test = require('node:test');
const assert = require('node:assert/strict');
const { searchUrl, parsePaste } = require('../maps.js');

test('search uses a free Google Maps URL without an API key', () => {
  const u = new URL(searchUrl("Puccini's", 'Greenfield, Indiana'));
  assert.equal(u.origin, 'https://www.google.com');
  assert.equal(u.pathname, '/maps/search/');
  assert.equal(u.searchParams.get('api'), '1');
  assert.match(u.searchParams.get('query'), /Puccini's Greenfield/);
});

test('free lookup works without a typed restaurant', () => {
  assert.match(new URL(searchUrl('', 'New Palestine, Indiana')).searchParams.get('query'), /^restaurants /);
});

test('pasted name and address fill both fields', () => {
  assert.deepEqual(parsePaste("Frosty Boy\n52 W Main St, New Palestine, IN\nhttps://maps.app.goo.gl/abc"), {
    name:'Frosty Boy',address:'52 W Main St, New Palestine, IN',shortLink:true
  });
});

test('full Google Maps place link provides a name', () => {
  assert.equal(parsePaste('https://www.google.com/maps/place/Culver%27s/@39.8,-85.8,13z').name, "Culver's");
});

test('Maps search URL with query provides place text', () => {
  assert.equal(parsePaste('https://www.google.com/maps/search/?api=1&query=Olive+Garden%2C+Greenfield').name, 'Olive Garden, Greenfield');
});

test('short Google Maps share link alone requires manual place name', () => {
  assert.deepEqual(parsePaste('https://maps.app.goo.gl/abc'), {name:'',address:'',shortLink:true});
});

test('ordinary names and address-only lines work', () => {
  assert.equal(parsePaste('Frosty Boy').name,'Frosty Boy');
  assert.equal(parsePaste('123 Main Street, Greenfield, IN').address,'123 Main Street, Greenfield, IN');
});

test('other websites cannot impersonate Google Maps URLs', () => {
  assert.equal(parsePaste('https://unrelated.example/maps/place/Example').name,'');
});
