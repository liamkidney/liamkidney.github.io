const COOKIE_USERNAME = "username";
const COOKIE_IP_ADDRESS = "ip_address";
const PARENT_DIV = document.getElementById("mainDiv");

function getBaseUrl(username, ip_address) {
    // const url = "http://192.168.1.232/api/qRH0xL93TL5YXlEiWHVuQSNiDkkTgj-CkklZNX2A/lights/9";
    return "https://" + ip_address + "/api/" + username + "/lights";
}

function getDeviceUrl(username, ip_address, device_id) {
    const url = getBaseUrl(username, ip_address);
    return url + "/" + device_id;
}

function draw(node, username, ip_address, dataDictionary) {
    console.log(dataDictionary);
    clearNodeChildren(node);
    addH1(node, "Devices");

    function getCallback(device_id, deviceData) {
        function callback(is_checked) {
            console.log(device_id);
            console.log(is_checked);
            const url = getDeviceUrl(username, ip_address, device_id);
            getJSON(url + "/state", console.log, console.log, {on: is_checked}, 'PUT')
        }

        return callback;
    }

    for (const [key, value] of Object.entries(dataDictionary)) {
        const toggle_data = key + ", " + value.name;

        let toggle = addToggle(node, toggle_data, getCallback(key, value));
        console.log(value);
        toggle.checked = value.state.on;
    }
}

function refresh(node, username, ip_address) {
    const url = getBaseUrl(username, ip_address);

    getJSON(url, function (dataDictionary) {
        draw(node, username, ip_address, dataDictionary)
    }, console.log);
}

function init() {
    const username = getLocal(COOKIE_USERNAME);
    const ip_address = getLocal(COOKIE_IP_ADDRESS);


    setTitle('Device Control');
    const input_div = addContainer(PARENT_DIV);
    const control_div = addContainer(PARENT_DIV);

    input_div.style.marginTop="1rem";
    control_div.style.marginTop="1rem";

    addH1(input_div, "Config");
    const ip_address_input = addTextInput(input_div, "IP Address");
    const username_input = addTextInput(input_div, "Username");

    addButton(input_div, "Save", function () {
        saveButtonClicked(ip_address_input, username_input, control_div)
    });

    if (username === "") {
        console.log('no username yet')
    } else {
        console.log(username);
        username_input.value = username;
    }

    if (ip_address === "") {
        console.log('no ip_address yet')
    } else {
        ip_address_input.value = ip_address;
    }

    if (ip_address !== "" && username !== "") {
        console.log('values set!');
        refresh(control_div, username, ip_address);
    }
}

function saveButtonClicked(ip_address_input, username_input, control_div) {
    console.log('saveButtonClicked');

    setLocal(COOKIE_USERNAME, username_input.value);
    setLocal(COOKIE_IP_ADDRESS, ip_address_input.value);

    refresh(control_div, username_input.value, ip_address_input.value);

}
