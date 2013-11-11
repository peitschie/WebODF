/**
 * @license
 * Copyright (C) 2012-2013 KO GmbH <copyright@kogmbh.com>
 *
 * @licstart
 * The JavaScript code in this page is free software: you can redistribute it
 * and/or modify it under the terms of the GNU Affero General Public License
 * (GNU AGPL) as published by the Free Software Foundation, either version 3 of
 * the License, or (at your option) any later version.  The code is distributed
 * WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
 * FITNESS FOR A PARTICULAR PURPOSE.  See the GNU AGPL for more details.
 *
 * As additional permission under GNU AGPL version 3 section 7, you
 * may distribute non-source (e.g., minimized or compacted) forms of
 * that code without the copy of the GNU GPL normally required by
 * section 4, provided you include this license notice and a URL
 * through which recipients can access the Corresponding Source.
 *
 * As a special exception to the AGPL, any HTML file which merely makes function
 * calls to this code, and for that purpose includes it by reference shall be
 * deemed a separate work for copyright law purposes. In addition, the copyright
 * holders of this code give you permission to combine this code with free
 * software libraries that are released under the GNU LGPL. You may copy and
 * distribute such a system following the terms of the GNU AGPL for this code
 * and the LGPL for the libraries. If you modify this code, you may extend this
 * exception to your version of the code, but you are not obligated to do so.
 * If you do not wish to do so, delete this exception statement from your
 * version.
 *
 * This license applies to this entire compilation.
 * @licend
 * @source: http://www.webodf.org/
 * @source: http://gitorious.org/webodf/webodf/
 */

/*global ops, runtime */

/**
 * @constructor
 * @implements ops.Operation
 */
ops.OpInsertFragment = function OpInsertFragment() {
    "use strict";

    var memberid, timestamp, position, length, fragment;

    function stripNamespaceAttributes(node) {
        var i, attr;
        if (node.attributes) {
            for (i = 0; i < node.attributes.length; i += 1) {
                attr = node.attributes[i];
                if (attr.prefix === "xmlns") {
                    node.removeAttributeNode(attr);
                    i -= 1; // Reprocess the new attribute at this index
                }
            }
        }
        for (i = 0; i < node.childNodes.length; i += 1) {
            stripNamespaceAttributes(node.childNodes[i]);
        }
    }

    function copyAttributes(nodeSrc, nodeDest) {
        var attrIndex, attrNode;
        if (nodeSrc.attributes && nodeDest.attributes) {
            for (attrIndex = 0; attrIndex < nodeSrc.attributes.length; attrIndex += 1) {
                attrNode = nodeSrc.attributes[attrIndex];
                nodeDest.setAttributeNS(attrNode.namespaceURI, attrNode.nodeName, attrNode.nodeValue);
            }
        }
    }

    this.init = function (data) {
        memberid = data.memberid;
        timestamp = data.timestamp;
        position = data.position;
        length = data.length;
        fragment = data.fragment;
    };

    this.execute = function (odtDocument) {
        var insertionPosition = odtDocument.getPositionInTextNode(position, memberid),
            destinationParagraph,
            destinationNode,
            insertionAnchor,
            paragraphFragment =  runtime.parseXML(fragment).firstChild;

        if (!insertionPosition) {
            return false;
        }

        stripNamespaceAttributes(paragraphFragment);
        destinationParagraph = odtDocument.getParagraphElement(insertionPosition.textNode);
        if (odtDocument.getWalkableParagraphLength(destinationParagraph) === 0) {
            copyAttributes(paragraphFragment, destinationParagraph);
        }

        destinationNode = insertionPosition.textNode.parentNode;
        insertionAnchor = insertionPosition.textNode.nextSibling;
        while (paragraphFragment.firstChild) {
            // TODO hyperlinks needs to be hooked up to the canvas to do something on click
            destinationNode.insertBefore(paragraphFragment.firstChild, insertionAnchor);
        }

        odtDocument.getOdfCanvas().refreshSize();
        odtDocument.emit(ops.OdtDocument.signalParagraphChanged, {
            paragraphElement: destinationNode,
            memberId: memberid,
            timeStamp: timestamp
        });

        return true;
    };

    this.spec = function () {
        return {
            optype: "InsertFragment",
            memberid: memberid,
            timestamp: timestamp,
            position: position,
            length: length,
            fragment: fragment
        };
    };

};