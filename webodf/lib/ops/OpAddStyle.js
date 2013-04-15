/*global ops*/

/**
 * @constructor
 * @implements ops.Operation
 */
ops.OpAddStyle = function OpAddStyle() {
    "use strict";

    var memberid, timestamp, info, styleType,
        webodfns = "urn:webodf:names:origin",
        /**@const*/ namespaces = {
            /**@const*/ 'fo' : "urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0",
            /**@const*/ 'style' : "urn:oasis:names:tc:opendocument:xmlns:style:1.0",
            /**@const*/ 'table' : "urn:oasis:names:tc:opendocument:xmlns:table:1.0"
        };

    this.init = function (data) {
        memberid = data.memberid;
        timestamp = data.timestamp;
        styleType = data.styleType;
        info = data.info;
    };

    function getNamespace(name) {
        var namespace = name.split(':', 2)[0];
        return namespaces[namespace];
    }

    function createElement(nodeName, nodeJSON, document) {
        var nodeNS = getNamespace(nodeName),
            node = document.createElementNS(nodeNS, nodeName);

        Object.keys(nodeJSON).forEach(function(key) {
            var value = nodeJSON[key],
                attrNS;
            if (typeof value === 'object') {
                node.appendChild(createElement(key, value, document));
            } else {
                attrNS = getNamespace(key);
                node.setAttributeNS(attrNS, key, value);
            }
        });

        return node;
    }

    this.execute = function (odtDocument) {
        var canvas = odtDocument.getOdfCanvas(),
            stylesCollection, styleNode;

        switch (styleType) {
            case 'automatic':
                stylesCollection = canvas.odfContainer().rootElement.automaticStyles;
                break;
            case 'master':
                stylesCollection = canvas.odfContainer().rootElement.masterStyles;
                break;
            default:
                stylesCollection = canvas.odfContainer().rootElement.styles;
                break;
        }

        styleNode = createElement("style:style", info, odtDocument.getDOM());
        styleNode.setAttributeNS(webodfns, "origin", "content.xml");
        stylesCollection.appendChild(styleNode);
        canvas.refreshCSS();
        odtDocument.emit(ops.OdtDocument.signalStyleCreated, info["style:style-name"]);
        return true;
    };

    this.spec = function () {
        return {
            optype: "AddStyle",
            memberid: memberid,
            timestamp: timestamp,
            styleType: styleType,
            info: info
        };
    };

};