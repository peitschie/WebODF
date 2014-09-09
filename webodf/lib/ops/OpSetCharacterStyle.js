ops.OpSetCharacterStyle = function () {
    "use strict";

    var memberid, timestamp, position, length, textStyleName,
        textns = "urn:oasis:names:tc:opendocument:xmlns:text:1.0",
        odfUtils = new odf.OdfUtils();

    /**
     * @param {!ops.OpSetCharacterStyle.InitSpec} data
     */
    this.init = function (data) {
        memberid = data.memberid;
        timestamp = data.timestamp;
        position = data.position;
        length = data.length;
        textStyleName = data.textStyleName;
    };

    this.isEdit = true;
    this.group = undefined;

    function isSplittableContainer(container) {
        return odfUtils.isHyperlink(container) || odfUtils.isGroupingElement(container);
    }

    function appendContainerClone(container) {

    }

    function moveToContainer(container, firstNode, lastNode) {
        var node = firstNode,
            nextSibling;
        while (node) {
            nextSibling = node.nextSibling;
            container.appendChild(node);
            if (node === lastNode) {
                break;
            }
            node = nextSibling;
        }
    }

    function splitContainerBefore(container, node) {
        var clone;
        if (node.previousSibling) {
            clone = container.cloneNode(false);
            container.parentNode.insertBefore(clone, container);
            moveToContainer(clone, container.firstChild, node.previousSibling);
        }
    }

    function splitContainerAfter(container, node) {
        if (node.nextSibling) {
            splitContainerBefore(container, node.nextSibling);
        }
    }

    function findOrCreateSpan(firstNode, lastNode) {
        var span = null,
            parent = firstNode.parentNode;

        runtime.assert(lastNode.parentNode === parent, "OpSetCharacterStyle: Both nodes should be within same parent");
        if (odfUtils.isParagraph(parent)) {
            span = parent.document.createElementNS(textns, "span");
            parent.insertBefore(span, firstNode);
            moveToContainer(span, firstNode, lastNode);
        } else if (odfUtils.isTextSpan(parent)) {
            span = parent;
            splitContainerBefore(parent, firstNode);
            splitContainerAfter(parent, lastNode);
        } else if (isSplittableContainer(parent)) {
            splitContainerBefore(parent, firstNode);
            splitContainerAfter(parent, lastNode);
            return findOrCreateSpan(parent, parent);
        }

        return span;
    }

    /**
     * @param {!Array.<!Node>} textElements
     * @return {!Array.<!{first: !Node, last: !Node}>}
     */
    function groupConsecutiveTextBlocks(textElements) {
        return textElements.reduce(function(blocks, textElement) {
            if (blocks.length > 0 && blocks[0].last.parentNode === textElement.parentNode) {
                blocks[0].last = textElement;
            } else {
                blocks.unshift({first: textElement, last: textElement});
            }
        }, [])
    }

    /**
     * @param {!ops.Document} document
     */
    this.execute = function (document) {
        var odtDocument = /**@type{ops.OdtDocument}*/(document),
            range = odtDocument.convertCursorToDomRange(position, length),
            impactedParagraphs = odfUtils.getParagraphElements(range),
            textElements,
            textBlocks,
            skippedElements = 0;

        range.splitBoundaries();
        textElements = odfUtils.getTextElements(range, false, false);
        textBlocks = groupConsecutiveTextBlocks(textElements);

        textBlocks.forEach(function(block) {
            var span = findOrCreateSpan(block.first, block.last);
            if (span) {
                span.setAttributeNS(textns, "text:style-name", textStyleName);
            } else {
                skippedElements += 1;
            }
        });

        if (skippedElements) {
            runtime.log("DEBUG: Skipped " + skippedElements + " text elements when applying character style " + textStyleName);
        }

        odtDocument.getOdfCanvas().refreshCSS();
        odtDocument.fixCursorPositions(); // The container splits may leave the cursor in an invalid spot

        impactedParagraphs.forEach(function (n) {
            odtDocument.emit(ops.OdtDocument.signalParagraphChanged, {
                paragraphElement: n,
                memberId: memberid,
                timeStamp: timestamp
            });
        });

        odtDocument.getOdfCanvas().rerenderAnnotations();
        return true;
    };

    /**
     * @return {!ops.OpSetCharacterStyle.Spec}
     */
    this.spec = function () {
        return {
            optype: "SetCharacterStyle",
            memberid: memberid,
            timestamp: timestamp,
            position: position,
            length: length,
            textStyle: textStyleName
        };
    };
};

/**@typedef{{
    optype:string,
    memberid:string,
    timestamp:number,
    position:number,
    length:number,
    textStyleName:string
}}*/
ops.OpSetCharacterStyle.Spec;
/**@typedef{{
    memberid:string,
    timestamp:(number|undefined),
    position:number,
    length:number,
    textStyleName:string
}}*/
ops.OpSetCharacterStyle.InitSpec;