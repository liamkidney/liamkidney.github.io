function setCookie(cname, cvalue, exdays) {
    const d = new Date();
    d.setTime(d.getTime() + (exdays * 24 * 60 * 60 * 1000));
    let expires = "expires=" + d.toUTCString();
    document.cookie = cname + "=" + cvalue + ";" + expires + ";path=/";
}

function getCookie(cname) {
    let name = cname + "=";
    let decodedCookie = decodeURIComponent(document.cookie);
    let ca = decodedCookie.split(';');
    for (let i = 0; i < ca.length; i++) {
        let c = ca[i];
        while (c.charAt(0) === ' ') {
            c = c.substring(1);
        }
        if (c.indexOf(name) === 0) {
            return c.substring(name.length, c.length);
        }
    }
    return "";
}

function setLocal(cname, cvalue) {
    localStorage.setItem(cname, cvalue);
}

function getLocal(cname){
    return localStorage.getItem(cname);
}

function setTitle(text){
    document.title = text;
}

function clearNodeChildren(node) {
    while (node.lastElementChild) {
        node.removeChild(node.lastElementChild);
    }
}

function getJSON(url, successCallback, errCallback, params, method) {
    let xhr = new XMLHttpRequest();

    if (method === undefined) {
        method = 'GET'
    }

    try {
        xhr.open(method, url, true);
    } catch(err){
        errCallback(status, err);
        return
    }

    xhr.responseType = 'json';
    xhr.onload = function () {
        let status = xhr.status;
        console.log('RESPONSE: ' + status);
        console.log(xhr.response);
        if (status === 200) {
            successCallback(xhr.response);
        } else {
            errCallback(status, xhr.response);
        }
    };
    xhr.send(JSON.stringify(params));
}
