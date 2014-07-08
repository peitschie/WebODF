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

/*global core, NodeFilter, console, JSON*/

(function() {
    "use strict";
    var INTERSECT = 0,
        CONTAINED = 1,
        FILTER_ACCEPT = NodeFilter.FILTER_ACCEPT,
        FILTER_SKIP = NodeFilter.FILTER_SKIP;

    /**
     *
     * @constructor
     * @param {!Range} range
     * @param {!function(!Node):!number=} filter
     */
    function RangeIterator(range, filter) {
        /**
         * @param {!Node} node
         * @param {!Array.<!Node>} acceptedNodes
         * @return {undefined}
         */
        function processCompleteNode(node, acceptedNodes) {
            var accept = filter ? filter(node) : FILTER_ACCEPT,
                child;

            if (accept === FILTER_ACCEPT || accept === FILTER_SKIP) {
                child = node.firstChild;
                while (child) {
                    processCompleteNode(child, acceptedNodes);
                    child = child.nextSibling;
                }
            }
            if (accept === FILTER_ACCEPT) {
                acceptedNodes.push(node);
            }
        }

        /**
         * Fetches the highest ancestor of the node still within the container.
         * This will be a direct child of container
         * @param {?Node} node
         * @param {!Node} container
         * @return {?Node}
         */
        function getAncestorInContainer(node, container) {
            var highestAncestor = null;
            while (node && node !== container) {
                highestAncestor = node;
                node = node.parentNode;
                if (!node) {
                    // node is not a child of the container
                    highestAncestor = null;
                    break;
                }
            }
            return highestAncestor;
        }

        /**
         * @param {!Node} node
         * @param {!Array.<!Node>} acceptedNodes
         * @param {!boolean=} isRoot
         * @return {undefined}
         */
        function processPartialNode(node, acceptedNodes, isRoot) {
            var accept = filter ? filter(node) : FILTER_ACCEPT,
                startChild,
                startType,
                endChild,
                endType,
                child;

            // Assumption is that the current node intersects the range (if a range is supplied)

            if ((accept === FILTER_ACCEPT || accept === FILTER_SKIP || isRoot) && node.hasChildNodes()) {
                if (range.startContainer === node) {
                    startChild = node.childNodes.item(range.startOffset);
                    startType = CONTAINED;
                } else {
                    startChild = getAncestorInContainer(range.startContainer, node);
                    if (startChild) {
                        startType = INTERSECT;
                    } else {
                        startChild = node.firstChild;
                        startType = CONTAINED;
                    }
                }

                if (startChild) {
                    if (range.endContainer === node) {
                        endChild = node.childNodes.item(range.endOffset - 1);
                        endType = CONTAINED;
                    } else {
                        endChild = getAncestorInContainer(range.endContainer, node);
                        if (endChild) {
                            endType = INTERSECT;
                        } else {
                            endChild = node.lastChild;
                            endType = CONTAINED;
                        }
                    }
                }

                if (startChild && endChild) {
                    child = startChild;
                    while (child) {
                        if ((child === startChild && startType === INTERSECT)
                                || (child === endChild && endType === INTERSECT)) {
                            processPartialNode(child, acceptedNodes);
                        } else {
                            processCompleteNode(child, acceptedNodes);
                        }
                        if (child === endChild) {
                            break;
                        }
                        child = child.nextSibling;
                    }
                }
            }
            if (accept === FILTER_ACCEPT) {
                acceptedNodes.push(node);
            }
        }

        /**
         * @return {!Array.<!Node>}
         */
        this.getNodes = function() {
            var nodes = [];
            processPartialNode(/**@type{!Node}*/(range.commonAncestorContainer), nodes, true);
            return nodes;
        };
    }

    /**
     *
     * @param {!Range} range
     * @param {!function(!Node):!number=} filter
     * @return {!Array.<!Node>}
     */
    core.iterateSubTree = function(range, filter) {
        return new RangeIterator(range, filter).getNodes();
    };
}());

