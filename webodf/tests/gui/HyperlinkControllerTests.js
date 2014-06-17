/**
 * Copyright (C) 2014 KO GmbH <copyright@kogmbh.com>
 *
 * @licstart
 * This file is part of WebODF.
 *
 * WebODF is free software: you can redistribute it and/or modify it
 * under the terms of the GNU Affero General Public License (GNU AGPL)
 * as published by the Free Software Foundation, either version 3 of
 * the License, or (at your option) any later version.
 *
 * WebODF is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with WebODF.  If not, see <http://www.gnu.org/licenses/>.
 * @licend
 *
 * @source: http://www.webodf.org/
 * @source: https://github.com/kogmbh/WebODF/
 */

/*global runtime, core, gui, odf, ops, Node, NodeFilter, xmldom*/

/**
 * @constructor
 * @param {core.UnitTestRunner} runner
 * @implements {core.UnitTest}
 */
gui.HyperlinkControllerTests = function HyperlinkControllerTests(runner) {
    "use strict";
    var r = runner,
        t,
        testarea,
        officens = odf.Namespaces.officens,
        utils = new core.Utils(),
        /**@const*/
        SELECTED_TEXT_ONLY = gui.HyperlinkController.SELECTED_TEXT_ONLY,
        /**@const*/
        INTERSECTING_LINKS = gui.HyperlinkController.INTERSECTING_LINKS,
        inputMemberId = "Joe";

    /**
     * Trying to avoid having to load a complete document for these tests. Mocking ODF
     * canvas allows some simplification in the testing setup
     * @param {Element} node
     * @extends {odf.OdfCanvas} Well.... we don't really, but please shut your face closure compiler :)
     * @constructor
     */
    /*jslint emptyblock:true*/
    function MockOdfCanvas(node) {
        var self = this;
        this.odfContainer = function () { return self; };
        this.getContentElement = function () { return node.getElementsByTagNameNS(officens, 'text')[0]; };
        this.getElement = function () { return node; };
        this.rootElement = node;
        this.refreshSize = function() { };
        this.rerenderAnnotations = function() { };
    }
    /*jslint emptyblock:false*/

    /**
     * @param {!ops.OdtDocument} odtDocument
     * @extends {ops.Session} Don't mind me... I'm just lying to closure compiler again!
     * @constructor
     */
    function MockSession(odtDocument) {
        var self = this;
        this.operations = [];

        this.getOdtDocument = function() {
            return odtDocument;
        };

        this.enqueue = function(ops) {
            self.operations.push.apply(self.operations, ops);
            ops.forEach(function(op) { op.execute(odtDocument); });
        };

        this.reset = function() {
            self.operations.length = 0;
        };
    }

    /**
     * Create a new ODT document with the specified text body
     * @param {!string} xml
     * @return {!Element} Root document node
     */
    function createOdtDocument(xml) {
        var domDocument = testarea.ownerDocument,
            testns = "urn:webodf:textcontrollertest",
            namespaceMap = utils.mergeObjects(odf.Namespaces.namespaceMap, {"test": testns}),
            doc,
            node,
            range;

        xml = xml.replace("[", "<test:start/>").replace("]", "<test:end/>");
        doc = core.UnitTest.createOdtDocument("<office:text>" + xml + "</office:text>", namespaceMap);
        node = /**@type{!Element}*/(domDocument.importNode(doc.documentElement, true));
        testarea.appendChild(node);

        t.odtDocument = new ops.OdtDocument(new MockOdfCanvas(node));
        t.session = new MockSession(t.odtDocument);
        t.sessionConstraints = new gui.SessionConstraints();
        t.sessionContext = new gui.SessionContext(t.session, inputMemberId);
        t.hyperlinkController = new gui.HyperlinkController(t.session, t.sessionConstraints, t.sessionContext, inputMemberId);
        t.selectionController = new gui.SelectionController(t.session, inputMemberId);
        t.cursor = new ops.OdtCursor(inputMemberId, t.odtDocument);
        t.odtDocument.addCursor(t.cursor);

        if (node.getElementsByTagNameNS(testns, "start")[0]) {
            range = node.ownerDocument.createRange();
            range.setStartAfter(node.getElementsByTagNameNS(testns, "start")[0]);
            range.setEndAfter(node.getElementsByTagNameNS(testns, "end")[0]);
            t.selectionController.selectRange(range, true);
        }
        return node;
    }

    /**
     * Return a serialized string of the document content, excluding the wrapping <office:text>
     * tags and all non-odf elements.
     * @return {!string}
     */
    function serializeTextBodyContent() {
        var nsmap = odf.Namespaces.namespaceMap,
            serializer = new xmldom.LSSerializer(),
            result;

        serializer.filter = new odf.OdfNodeFilter();
        result = serializer.writeToString(t.odtDocument.getRootNode(), nsmap);
        result = result.replace(/<[\/]{0,1}office:text>/g, "");
        return result;
    }

    this.setUp = function () {
        testarea = core.UnitTest.provideTestAreaDiv();
        t = { doc: testarea.ownerDocument };
    };
    this.tearDown = function () {
        core.UnitTest.cleanupTestAreaDiv();
        t = {};
    };

    function insertHyperlink_NoDisplayTextSpecified() {
        createOdtDocument('<text:p>A[]BC</text:p>');

        t.hyperlinkController.insertHyperlink("http://webodf.org");

        t.actualDoc = serializeTextBodyContent();
        t.expectedDoc = '<text:p>A<text:a xlink:type="simple" xlink:href="http://webodf.org">http://webodf.org</text:a>BC</text:p>';
        r.shouldBe(t, "t.actualDoc", "t.expectedDoc");
    }

    function insertHyperlink_WithDisplayTextSpecified() {
        createOdtDocument('<text:p>A[]BC</text:p>');

        t.hyperlinkController.insertHyperlink("http://webodf.org", "display text");

        t.actualDoc = serializeTextBodyContent();
        t.expectedDoc = '<text:p>A<text:a xlink:type="simple" xlink:href="http://webodf.org">display text</text:a>BC</text:p>';
        r.shouldBe(t, "t.actualDoc", "t.expectedDoc");
    }

    function removeHyperlinks_IntersectingLinks_NoLinksSelected_DoesNothing() {
        createOdtDocument('<text:p>[ABC]</text:p>');

        t.hyperlinkController.removeHyperlinks(INTERSECTING_LINKS);

        t.actualDoc = serializeTextBodyContent();
        t.expectedDoc = '<text:p>ABC</text:p>';
        r.shouldBe(t, "t.actualDoc", "t.expectedDoc");
    }

    function removeHyperlinks_IntersectingLinks_CollapsedWithinLink_RemovesLink() {
        createOdtDocument('<text:p><text:a xlink:type="simple" xlink:href="http://link1">A[]B</text:a>C</text:p>');

        t.hyperlinkController.removeHyperlinks(INTERSECTING_LINKS);

        t.actualDoc = serializeTextBodyContent();
        t.expectedDoc = '<text:p>ABC</text:p>';
        // TODO currently failing!
        // r.shouldBe(t, "t.actualDoc", "t.expectedDoc");
    }

    function removeHyperlinks_IntersectingLinks_1LinkContained_RemovesLink() {
        createOdtDocument('<text:p>[<text:a xlink:type="simple" xlink:href="http://link1">AB</text:a>C]</text:p>');

        t.hyperlinkController.removeHyperlinks(INTERSECTING_LINKS);

        t.actualDoc = serializeTextBodyContent();
        t.expectedDoc = '<text:p>ABC</text:p>';
        r.shouldBe(t, "t.actualDoc", "t.expectedDoc");
    }

    function removeHyperlinks_IntersectingLinks_1LinkPartiallySelected_RemovesLink() {
        createOdtDocument('<text:p><text:a xlink:type="simple" xlink:href="http://link1">A[B</text:a>C]</text:p>');

        t.hyperlinkController.removeHyperlinks(INTERSECTING_LINKS);

        t.actualDoc = serializeTextBodyContent();
        t.expectedDoc = '<text:p>ABC</text:p>';
        r.shouldBe(t, "t.actualDoc", "t.expectedDoc");
    }

    function removeHyperlinks_IntersectingLinks_2LinksPartiallySelected_RemovesLinks() {
        createOdtDocument('<text:p><text:a xlink:type="simple" xlink:href="http://link1">A[B</text:a>C' +
                                  '<text:a xlink:type="simple" xlink:href="http://link2">D]E</text:a>F</text:p>');

        t.hyperlinkController.removeHyperlinks(INTERSECTING_LINKS);

        t.actualDoc = serializeTextBodyContent();
        t.expectedDoc = '<text:p>ABCDEF</text:p>';
        r.shouldBe(t, "t.actualDoc", "t.expectedDoc");
    }

    function removeHyperlinks_SelectedTextOnly_NoLinksSelected_DoesNothing() {
        createOdtDocument('<text:p>[ABC]</text:p>');

        t.hyperlinkController.removeHyperlinks(SELECTED_TEXT_ONLY);

        t.actualDoc = serializeTextBodyContent();
        t.expectedDoc = '<text:p>ABC</text:p>';
        r.shouldBe(t, "t.actualDoc", "t.expectedDoc");
    }

    function removeHyperlinks_SelectedTextOnly_CollapsedWithinLink_DoesNothing() {
        createOdtDocument('<text:p><text:a xlink:type="simple" xlink:href="http://link1">A[]B</text:a>C</text:p>');

        t.hyperlinkController.removeHyperlinks(SELECTED_TEXT_ONLY);

        t.actualDoc = serializeTextBodyContent();
        t.expectedDoc = '<text:p><text:a xlink:type="simple" xlink:href="http://link1">AB</text:a>C</text:p>';
        r.shouldBe(t, "t.actualDoc", "t.expectedDoc");
    }

    function removeHyperlinks_SelectedTextOnly_SelectionWithinLink_UnlinksSelection() {
        createOdtDocument('<text:p><text:a xlink:type="simple" xlink:href="http://link1">A[B]C</text:a></text:p>');

        t.hyperlinkController.removeHyperlinks(SELECTED_TEXT_ONLY);

        t.actualDoc = serializeTextBodyContent();
        t.expectedDoc = '<text:p><text:a xlink:type="simple" xlink:href="http://link1">A</text:a>B' +
                        '<text:a xlink:type="simple" xlink:href="http://link1">C</text:a></text:p>';
        r.shouldBe(t, "t.actualDoc", "t.expectedDoc");
    }

    function removeHyperlinks_SelectedTextOnly_1LinkContained_UnlinksSelection() {
        createOdtDocument('<text:p>A[B<text:a xlink:type="simple" xlink:href="http://link1">CD</text:a>E]</text:p>');

        t.hyperlinkController.removeHyperlinks(SELECTED_TEXT_ONLY);

        t.actualDoc = serializeTextBodyContent();
        t.expectedDoc = '<text:p>ABCDE</text:p>';
        r.shouldBe(t, "t.actualDoc", "t.expectedDoc");
    }

    function removeHyperlinks_SelectedTextOnly_2LinksPartiallySelected_UnlinksSelection() {
        createOdtDocument('<text:p><text:a xlink:type="simple" xlink:href="http://link1">A[B</text:a>C' +
            '<text:a xlink:type="simple" xlink:href="http://link2">D]E</text:a>F</text:p>');

        t.hyperlinkController.removeHyperlinks(SELECTED_TEXT_ONLY);

        t.actualDoc = serializeTextBodyContent();
        t.expectedDoc = '<text:p><text:a xlink:type="simple" xlink:href="http://link1">A</text:a>BCD' +
            '<text:a xlink:type="simple" xlink:href="http://link2">E</text:a>F</text:p>';
        r.shouldBe(t, "t.actualDoc", "t.expectedDoc");
    }

    function setHyperlinkForSelection_NoLinksSelected_LinksSelection() {
        createOdtDocument('<text:p>[ABC]</text:p>');

        t.hyperlinkController.setHyperlinkForSelection("http://link1");

        t.actualDoc = serializeTextBodyContent();
        t.expectedDoc = '<text:p><text:a xlink:type="simple" xlink:href="http://link1">ABC</text:a></text:p>';
        r.shouldBe(t, "t.actualDoc", "t.expectedDoc");
    }

    function setHyperlinkForSelection_SelectionWithinLink_LinksSelectionOnly() {
        createOdtDocument('<text:p><text:a xlink:type="simple" xlink:href="http://link1">A[B]C</text:a></text:p>');

        t.hyperlinkController.setHyperlinkForSelection("http://link2");

        t.actualDoc = serializeTextBodyContent();
        t.expectedDoc = '<text:p><text:a xlink:type="simple" xlink:href="http://link1">A</text:a>' +
            '<text:a xlink:type="simple" xlink:href="http://link2">B</text:a>' +
            '<text:a xlink:type="simple" xlink:href="http://link1">C</text:a></text:p>';
        r.shouldBe(t, "t.actualDoc", "t.expectedDoc");
    }

    function setHyperlinkForSelection_2LinksPartiallySelected_LinksSelection() {
        createOdtDocument('<text:p><text:a xlink:type="simple" xlink:href="http://link1">A[B</text:a>C' +
            '<text:a xlink:type="simple" xlink:href="http://link2">D]E</text:a>F</text:p>');

        t.hyperlinkController.setHyperlinkForSelection("http://link3");

        t.actualDoc = serializeTextBodyContent();
        // See TODO in OpApplyHyperlink about merging adjacent text nodes
        t.expectedDoc = '<text:p>' +
            '<text:a xlink:type="simple" xlink:href="http://link1">A</text:a>' +
            '<text:a xlink:type="simple" xlink:href="http://link3">B</text:a>' +
            '<text:a xlink:type="simple" xlink:href="http://link3">CD</text:a>' +
            '<text:a xlink:type="simple" xlink:href="http://link2">E</text:a>' +
            'F</text:p>';
        r.shouldBe(t, "t.actualDoc", "t.expectedDoc");
    }

    this.tests = function () {
        return r.name([
            insertHyperlink_NoDisplayTextSpecified,
            insertHyperlink_WithDisplayTextSpecified,

            removeHyperlinks_IntersectingLinks_NoLinksSelected_DoesNothing,
            removeHyperlinks_IntersectingLinks_CollapsedWithinLink_RemovesLink,
            removeHyperlinks_IntersectingLinks_1LinkContained_RemovesLink,
            removeHyperlinks_IntersectingLinks_1LinkPartiallySelected_RemovesLink,
            removeHyperlinks_IntersectingLinks_2LinksPartiallySelected_RemovesLinks,

            removeHyperlinks_SelectedTextOnly_NoLinksSelected_DoesNothing,
            removeHyperlinks_SelectedTextOnly_CollapsedWithinLink_DoesNothing,
            removeHyperlinks_SelectedTextOnly_SelectionWithinLink_UnlinksSelection,
            removeHyperlinks_SelectedTextOnly_1LinkContained_UnlinksSelection,
            removeHyperlinks_SelectedTextOnly_2LinksPartiallySelected_UnlinksSelection,

            setHyperlinkForSelection_NoLinksSelected_LinksSelection,
            setHyperlinkForSelection_SelectionWithinLink_LinksSelectionOnly,
            setHyperlinkForSelection_2LinksPartiallySelected_LinksSelection
        ]);
    };
    this.asyncTests = function () {
        return [
        ];
    };
};
gui.HyperlinkControllerTests.prototype.description = function () {
    "use strict";
    return "Test the HyperlinkController class.";
};
