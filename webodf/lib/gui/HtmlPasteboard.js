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
 * You should have received a copy of the GNU Affero General Public License
 * along with this code.  If not, see <http://www.gnu.org/licenses/>.
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
 * @source: https://github.com/kogmbh/WebODF/
 */

/*global runtime, gui, core, odf, xmldom, Node, ops*/

runtime.loadClass("core.DomUtils");
runtime.loadClass("odf.OdfUtils");
runtime.loadClass("odf.Namespaces");
runtime.loadClass("xmldom.LSSerializer");

/**
 *
 * @param {!ops.OdtDocument} odtDocument
 * @param {!string} inputMemberId
 * @constructor
 */
gui.HtmlPasteboard = function HtmlPasteboard(odtDocument, inputMemberId) {
    "use strict";
    var domUtils = new core.DomUtils(),
        odfUtils = new odf.OdfUtils(),
        textns = odf.Namespaces.textns,
        nsMap = odf.Namespaces.namespaceMap,
        odfNamespaces = Object.keys(nsMap).map(function(prefix) { return nsMap[prefix]; });

    function isOdfFragment(xml) {
        return Object.keys(nsMap).some(function(prefix) {
            return xml.indexOf("<" + prefix + ":") !== -1 || xml.indexOf(nsMap[prefix]) !== -1;
        });
    }

    function addOdfNamespaces(xml) {
        var insertionPoint = xml.indexOf(">"),
            xmlBefore = xml.substr(0, insertionPoint),
            xmlAfter = xml.substr(insertionPoint),
            headers = "";

        Object.keys(nsMap).forEach(function(prefix) {
            headers += " xmlns:" + prefix + "=\"" + nsMap[prefix] + "\"";
        });
        return xmlBefore + headers + xmlAfter;
    }
    this.addOdfNamespaces = addOdfNamespaces;

    function adoptHtmlAttributes(node) {
        var attrIndex, attrNode, newAttrs = [], removeAttrs = [];
        if (node.attributes) {
            for (attrIndex = 0; attrIndex < node.attributes.length; attrIndex += 1) {
                attrNode = node.attributes[attrIndex];
                if (odfNamespaces.indexOf(attrNode.namespaceURI) === -1) {
                    switch (attrNode.localName) {
                        case "style-name":
                            newAttrs.push({ns: textns, name: "text:" + attrNode.localName, value: attrNode.nodeValue});
                            removeAttrs.push(attrNode);
                            break;
                    }
                }
            }
            newAttrs.forEach(function(attr) {
                node.setAttributeNS(attr.ns, attr.name, attr.value);
            });
            removeAttrs.forEach(function(attr) {
                node.removeAttributeNode(attr);
            });
        }
    }

    function adoptHtmlNodes(node) {
        var document = node.ownerDocument,
            replaceWith,
            attr;
        adoptHtmlAttributes(node);
        node = node.firstChild;
        while (node) {
            replaceWith = null;
            if (odfNamespaces.indexOf(node.namespaceURI) === -1) {
                switch (node.localName) {
                    case "p":
                    case "span":
                    case "a":
                        replaceWith = document.createElementNS(textns, "text:" + node.localName);
                        break;
                    case "h1":
                    case "h2":
                    case "h3":
                    case "h4":
                    case "h5":
                    case "h6":
                        // TODO should adapt to the document's heading style equivalent
                        replaceWith = document.createElementNS(textns, "text:h");
                        break;
                    case "div":
                        replaceWith = document.createElementNS(textns, "text:p");
                        break;
                }
                if (replaceWith) {
                    while (node.firstChild) {
                        replaceWith.appendChild(node.firstChild);
                    }
                    for (attr = 0; attr < node.attributes.length; attr += 1) {
                        // TODO pull off any style information and turn into an auto-style
                        // TODO get style name if specified
                        // Potential heuristics for style preservation:
                        // - existing auto style => duplicate & link
                        // - existing style => use
                        // - non-present style => use defaults & create auto-style
                        replaceWith.setAttributeNodeNS(node.attributes[attr].cloneNode(true));
                    }
                    node.parentNode.replaceChild(replaceWith, node);
                    node = replaceWith;
                }
            }
            adoptHtmlNodes(node);
            node = node.nextSibling;
        }
    }

    function sanitizeAttributes(node) {
        if (node.hasAttributes && node.hasAttributes()) {
            node.removeAttribute("style");
        }
    }

    /**
     * At the moment this is really really picky about what it accepts for paste in order
     * to keep fragment processing logic simple
     * @param fragment
     */
    function sanitizeChildren(fragment) {
        var node = fragment.firstChild,
            nextNode;
        // TODO compress nested p or h's
        while (node) {
            sanitizeChildren(node);
            sanitizeAttributes(node);
            if (odfUtils.isCharacterElement(node)
                || odfUtils.isGroupingElement(node)
                || node.nodeType === Node.TEXT_NODE) {
                node = node.nextSibling;
            } else {
                nextNode = node.previousSibling || node.nextSibling;
                domUtils.mergeIntoParent(node);
                node = nextNode;
            }
        }
    }

    function getParagraphs(node) {
        return domUtils.getElementsByTagNameNS(node, textns, "p")
            .concat(domUtils.getElementsByTagNameNS(node, textns, "h"));
    }

    /**
     * Chrome/Safari & FF all put an unclosed '<meta charset="utf-8">' tag at the beginning of the fragment
     * @param {!string} xml
     * @returns {!string}
     */
    function stripUnclosedMeta(xml) {
        var searchString = "<meta",
            closeTag;
        if (xml.substr(0, searchString.length) === searchString) {
            // TODO handle ">" appearing in meta content somewhere
            closeTag = xml.indexOf(">");
            xml = xml.substring(closeTag + 1, xml.length);
        }
        return xml;
    }

    function sanitizeMSOfficeXml(xml) {
        // http://stackoverflow.com/questions/1068280/javascript-regex-multiline-flag-doesnt-work
        // TODO handle ">" appearing in content somewhere
        // MSOffice doesn't close out any meta or link tags
        // xml = xml.replace(/<meta([\s\S]*?)\/?>/g, "<meta$1/>");
        // xml = xml.replace(/<link([\s\S]*?)\/?>/g, "<link$1/>");
        xml = xml.replace(/<(meta|link)([\s\S]*?)\/?>/g, "");
        // It also doesn't wrap some attribute values in quotes
        xml = xml.replace(/=([^"'][^\s/>]+)([\s/>])/g, "=\"$1\"$2");
        return xml;
    }

    /**
     * @param {!string} xml
     * @return {{paragraphs: Array.<!Node>}}
     */
    function extractOdfFragment (xml) {
        var doc, paragraphs, newContainer;
        if (isOdfFragment(xml)) {
            xml = addOdfNamespaces(xml);
        }
        xml = "<document>" + stripUnclosedMeta(xml) + "</document>";
        xml = sanitizeMSOfficeXml(xml);
        doc = /**@type{!HTMLDocument}*/(runtime.parseXML(xml));
        adoptHtmlNodes(doc);

        // TODO verify each text node is within at least one paragraph
        paragraphs = getParagraphs(doc);

        if (paragraphs.length === 0) {
            newContainer = doc.createElementNS(textns, "p");
            while (doc.firstChild) {
                newContainer.appendChild(doc.firstChild);
            }
            paragraphs.push(newContainer);
        }
        paragraphs.forEach(sanitizeChildren);

        // TODO remove paragraph styles that don't exist
        // TODO extract direct formatting and recreate
        return {paragraphs: paragraphs};
    }

    function serializeElement(element) {
        var serializer = new xmldom.LSSerializer();
        return serializer.writeToString(element, odf.Namespaces.namespaceMap);
    }

    function createOp(op, data) {
        op.init(data);
        return op;
    }

    /**
     * @param {!string} data
     *
     * @return {!Array.<!ops.Operation>}
     */
    this.paste = function(data) {
        var originalCursorPosition = odtDocument.getCursorPosition(inputMemberId),
            cursorPosition = originalCursorPosition,
            operations = [],
            fragment = extractOdfFragment(data);

        fragment.paragraphs.forEach(function(container) {
            // Fragment length is 1 less than the number of available cursor positions.
            // This is because the insertion is effectively happening within an existing paragraph,
            // so position 0 already exists due to the prior OpSplitParagraph
            var fragmentLength = odtDocument.getWalkableParagraphLength(container) - 1;

            operations.push(createOp(new ops.OpSplitParagraph(), {
                memberid: inputMemberId,
                position: cursorPosition
            }));
            cursorPosition += 1; // Splitting a paragraph introduces 1 walkable position, bumping the cursor forward
            operations.push(createOp(new ops.OpInsertFragment(), {
                memberid: inputMemberId,
                position: cursorPosition,
                fragment: addOdfNamespaces(serializeElement(container)),
                length: fragmentLength
            }));
            cursorPosition += fragmentLength;
        });

        // Merge the first element back into the first paragraph
        operations.push(createOp(new ops.OpRemoveText(), {
            memberid: inputMemberId,
            position: originalCursorPosition,
            length: 1
        }));

        return operations;
    };
};