```js
/*
   st-mysql 을 사용해서 얻은 DB-POOL 을 함께 사용합니다
   npm -i st-mysql st-session 해서 인스톨해주세요
   
   아래 코드는 사용예제입니다
*/
const express = require('express')
const app = express()
const port = 2003
const query = require('st-mysql')({
    host: 'localhost',
    user: '디비아이디',
    password: '디비패스워드',
    database: '디비이름',
    flat: true
});
const stsession = require("st-session")(query, {
    table: 'session10',
    keep_lasting: {
        renew: 100,
        last: 3600 * 24 * 365 * 10,
    },
    basics: {
        Path: '/',
        SameSite: 'Lax',
        HttpOnly: true,
        Secure: true,
    }
})
app.listen(port, function () {
})
app.get('/cookietest', function (req, res) {
    (async () => {

        // 세션 데이터를 가져옵니다
        // 만약 요청헤더에 Cookie 가 없다면 {} 를 리턴해줍니다
        // 만약 요청헤더에 Cookie 가 있다면 세션 데이터를 가져옵니다
        // 만약 요청헤더에 있는 Cookie 가 만료되었고, keep_lasting이 true라면 함수 실행에 의해 기존의 쿠키값은 제거되고, 새로운 쿠키값이 발행되고 그것이 req.headers.cookie 의 값을 업데이트하고, 응답헤더에 Set-Cookie 를 담습니다. 그리고 기존 세션데이터를 가져옵니다
        let session_data = await stsession.get_attributes(req, res);

        // 세션 데이터를 기록합니다
        // 세번째 인자의 내용을 기록합니다
        // 네번째 인자를 false 로 주면 기존에 기록된 세션데이터에 세번째 인자 내용을 더합니다
        // 네번째 인자를 true 로 주면 기존에 기록된 세션데이터에 세번째 인자 내용을 더하지 않고 덮어씁니다
        session_data = await stsession.set_attributes(req, res, {data: 'hello'});
        
        res.send(session_data);
    })();
});

```
