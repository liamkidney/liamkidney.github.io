function addButton(parent, text, callback) {
    const button = document.createElement("input");
    button.className = "btn btn-primary";
    button.type = "button";
    button.value = text;
    button.onclick = callback;

    parent.appendChild(button);

    return button;
}

function addDiv(parent) {
    const div = document.createElement("div");
    parent.appendChild(div);
    return div;
}

function addH1(parent, text) {
    const h1 = document.createElement("h1");
    h1.innerText = text;
    parent.appendChild(h1);
    return h1;
}

function addContainer(parent) {
    const div = addDiv(parent);
    div.className  = "container";
    return div;
}

function addTextInput(parent, text) {

    const div = document.createElement("div");
    const span = document.createElement("span");
    const input = document.createElement("input");

    div.className = "input-group mb-3";
    span.className = "input-group-text";
    span.innerText = text;
    input.type = "text";
    input.className = "form-control";
    input.placeholder = text;
    input.ariaLabel = text;

    div.appendChild(span);
    div.appendChild(input);

    parent.appendChild(div);

    return input;
}

function addToggle(parent, text, callback) {
    const div = document.createElement("div");

    const input = document.createElement("input");
    const label = document.createElement("label");

    div.className = "form-check form-switch";

    input.className = "form-check-input";
    input.type = "checkbox";
    input.role = "switch";
    input.placeholder = text;
    input.ariaLabel = text;
    input.onclick = function () {
        callback(input.checked)
    };

    label.className = "form-check-label";
    label.innerText = text;

    div.appendChild(label);
    div.appendChild(input);

    parent.appendChild(div);

    return input;
}
