const https = require('https');

const SITE_ID = '6e554a7d-d5fe-4e05-b823-322c53cef72c';
const STORE   = 'site-content';

function getToken() {
  return process.env.NETLIFY_TOKEN || '';
}

function apiRequest(method, key, bodyData) {
  return new Promise((resolve, reject) => {
    const token   = getToken();
    const path    = `/api/v1/blobs/${SITE_ID}/production/${STORE}/${encodeURIComponent(key)}`;
    const bodyStr = bodyData ? JSON.stringify(bodyData) : null;
    const options = {
      hostname: 'api.netlify.com',
      path, method,
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
    };
    if (bodyStr) options.headers['Content-Length'] = Buffer.byteLength(bodyStr);
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  const key = (event.queryStringParameters || {}).key || 'content';
  try {
    if (event.httpMethod === 'GET') {
      const result = await apiRequest('GET', key);
      if (result.status === 404 || result.status === 400) {
        return { statusCode: 200, headers, body: JSON.stringify(getDefaults(key)) };
      }
      try {
        return { statusCode: 200, headers, body: JSON.stringify(JSON.parse(result.body)) };
      } catch {
        return { statusCode: 200, headers, body: result.body };
      }
    }
    if (event.httpMethod === 'POST') {
      const payload = JSON.parse(event.body || '{}');
      const result  = await apiRequest('PUT', key, payload);
      if (result.status >= 200 && result.status < 300) {
        return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
      }
      return { statusCode: result.status, headers, body: JSON.stringify({ error: result.body }) };
    }
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  } catch (err) {
    console.error('Blob error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};

function getDefaults(key) {
  if (key === 'signings')  return [];
  if (key === 'excerpts')  return { tab1:{label:'The Mission',text:'',page:''}, tab2:{label:'From the Field',text:'',page:''}, tab3:{label:'A Reason for Hope',text:'',page:''} };
  if (key === 'posts')     return [];
  if (key === 'questions') return { featured: [] };
  if (key === 'settings')  return { email:'rick@rickthames.com', amazon:'https://a.co/d/0eMvFtaJ', bn:'https://www.barnesandnoble.com/w/why-local-news-rick-thames/1148285737', signingsVisible:true, forumOpen:'open' };
  return {};
}
