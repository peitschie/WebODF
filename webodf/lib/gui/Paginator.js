/**
 * Copyright (C) 2010-2014 KO GmbH <copyright@kogmbh.com>
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

/*global gui, odf, xmldom*/

/**
 * @constructor
 * @param {!odf.OdfCanvas} odfCanvas
 */
gui.Paginator = function(odfCanvas) {
    "use strict";
    var xpath = xmldom.XPath,
        helperns = "urn:webodf:names:helper";

    /**
     * Completely fake render code! Expect nothing fancy :-)
     * @return {undefined}
     */
    this.render = function() {
        var element = odfCanvas.getElement(),
            node = xpath.getODFElementsWithXPath(element, "//text:p[@text:style-name='P3']", odf.Namespaces.lookupNamespaceURI)[0],
            pageBreak = element.ownerDocument.createElementNS(helperns, "page-break");

        node.parentNode.insertBefore(pageBreak, node);
    };
};