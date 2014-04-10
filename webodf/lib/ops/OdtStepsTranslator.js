/**
 * Copyright (C) 2012-2013 KO GmbH <copyright@kogmbh.com>
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

/*global runtime, core, ops, odf*/

(function () {
    "use strict";
    var domUtils = core.DomUtils;

    /**
     * @constructor
     * @param {!core.PositionIterator} iterator
     */
    function DomPoint(iterator) {
        var /**@type{!{container: !Node, offset: !number, bookmarkAfterRealPoint: !boolean}}*/
            selfPoint;

        /**
         * @param {!core.PositionIterator} otherIterator
         * @return {!boolean}
         */
        this.isEqualTo = function(otherIterator) {
            var otherIsBeforeNode = otherIterator.isBeforeNode();
            // IMPORTANT the following comparisons are made in the order of least to most expensive
            return selfPoint.bookmarkAfterRealPoint === otherIsBeforeNode
                && selfPoint.offset === (otherIsBeforeNode ? 0 : otherIterator.unfilteredDomOffset())
                && selfPoint.container === (otherIsBeforeNode ? otherIterator.getCurrentNode() : otherIterator.container());
        };

        /**
         * @param {!core.PositionIterator} iterator
         * @return {!{container: !Node, offset: !number, bookmarkAfterRealPoint: !boolean}}
         */
        function getPoint(iterator) {
            if (iterator.isBeforeNode()) {
                return {
                    container: iterator.getCurrentNode(),
                    offset: 0,
                    bookmarkAfterRealPoint: true
                };
            }
            return {
                container: iterator.container(),
                offset: iterator.unfilteredDomOffset(),
                bookmarkAfterRealPoint: false
            };
        }

        /**
         * @param {!core.PositionIterator} otherIterator
         * @return {!number}
         */
        this.comparePositionTo = function(otherIterator) {
            var otherPoint = getPoint(otherIterator),
                compareResult = domUtils.comparePoints(selfPoint.container, selfPoint.offset,
                    otherPoint.container, otherPoint.offset),
                finalResult;

            if (selfPoint.bookmarkAfterRealPoint === otherPoint.bookmarkAfterRealPoint) {
                finalResult = compareResult;
            } else if (selfPoint.bookmarkAfterRealPoint) {
                // Note: selfPoint is 1 step after the actual point.
                if (compareResult === 0) {
                    // if selfPoint === otherPoint exactly, then selfPoint is just before otherPoint
                    finalResult = 1;
                } else if (compareResult === -1 && selfPoint.container.parentNode === otherPoint.container) {
                    // if otherPoint is just before selfPoint and is the direct parent, then selfPoint is actually
                    // the identical position, as selfPoint is effectively advanced by one position
                    finalResult = 0;
                } else {
                    finalResult = compareResult;
                }
            } else {
                // Note: otherPoint is 1 step after the actual point.
                if (compareResult === 0) {
                    // if selfPoint === otherPoint exactly, then otherPoint is just before selfPoint
                    finalResult = -1;
                } else if (compareResult === 1 && otherPoint.container.parentNode === selfPoint.container) {
                    finalResult = 0;
                } else {
                    finalResult = compareResult;
                }
            }

            return finalResult;
        };


        selfPoint = getPoint(iterator);

        /**
         * @type {!Node}
         */
        this.container = selfPoint.container;

        /**
         * @type {!number}
         */
        this.offset = selfPoint.offset;
    }

    /**
     *
     * @constructor
     * @param {!function():!Element} getRootNode
     * @param {!function(!Node):!core.PositionIterator} newIterator
     * @param {!core.PositionFilter} filter
     * @param {!number} bucketSize  Minimum number of steps between cache points
     */
    ops.OdtStepsTranslator = function OdtStepsTranslator(getRootNode, newIterator, filter, bucketSize) {
        var rootNode,
            /**@type{!ops.StepsCache}*/
            stepsCache,
            odfUtils = odf.OdfUtils,
            /**@type{!core.PositionIterator}*/
            iterator,
            /**@const*/
            FILTER_ACCEPT = core.PositionFilter.FilterResult.FILTER_ACCEPT,
            /**@const*/
            PREVIOUS = core.StepDirection.PREVIOUS,
            /**@const*/
            NEXT = core.StepDirection.NEXT;

        /**
         * Update the steps cache based on the current iterator position. This can either add new
         * bookmarks or update existing references and repair damaged regions of the cache.
         *
         * @param {!number} steps
         * @param {!core.PositionIterator} iterator
         * @param {!boolean} isStep
         * @return {undefined}
         */
        function updateCache(steps, iterator, isStep) {
            var node;

            if (iterator.isBeforeNode()) {
                node = iterator.getCurrentNode();
                if (odfUtils.isParagraph(node)) {
                    if (!isStep) {
                        // Paragraph bookmarks indicate "first position in the paragraph"
                        // If the current stable point is before the first walkable position (as often happens)
                        // simply increase the step number by 1 to move to within the paragraph node
                        steps += 1;
                    }
                    stepsCache.updateBookmark(steps, node);
                }
            }
        }

        /**
         * Saved bookmarks always represent the first step inside the corresponding paragraph or node. Based on the
         * current TextPositionFilter impl, this means rounding up if the current iterator position is not on a step.
         * @param {!number} steps
         * @param {!core.PositionIterator} iterator
         * @return {undefined}
         */
        function roundUpToStep(steps, iterator) {
            do {
                if (filter.acceptPosition(iterator) === FILTER_ACCEPT) {
                    // Have reached the step represented by the paragraph bookmark
                    updateCache(steps, iterator, true);
                    break;
                }
                // This logic inverts the +1 logic in updateCache. Conceptually speaking, the stored
                // bookmark represents the first step in the paragraph. Until the first step is found,
                // the iterator is still technically on steps-1.
                updateCache(steps - 1, iterator, false);
            } while (iterator.nextPosition());
        }

        /**
         * This evil little check is necessary because someone, not mentioning any names *cough*
         * added an extremely hacky undo manager that replaces the root node in order to go back
         * to a prior document state.
         * This makes things very sad, and kills baby kittens.
         * Unfortunately, no-one has had time yet to write a *real* undo stack... so we just need
         * to cope with it for now.
         * @return {undefined}
         */
        function verifyRootNode() {
            // TODO Remove when a proper undo manager arrives
            var currentRootNode = getRootNode();
            if (currentRootNode !== rootNode) {
                if (rootNode) {
                    // verifyRootNode is called during init. Don't log misleading messages in this case
                    runtime.log("Undo detected. Resetting steps cache");
                }
                rootNode = currentRootNode;
                stepsCache = new ops.StepsCache(rootNode, bucketSize, roundUpToStep);
                iterator = newIterator(rootNode);
            }
        }

        /**
         * Convert the requested steps from root into the equivalent DOM node & offset pair. If the
         * requested step is before the start or past the end of the document, a RangeError will be thrown.
         * @param {!number} steps
         * @return {!{node: !Node, offset: !number}}
         */
        this.convertStepsToDomPoint = function (steps) {
            var /**@type{!number}*/
                stepsFromRoot,
                isStep;

            if (isNaN(steps)) {
                throw new TypeError("Requested steps is not numeric (" + steps + ")");
            }
            if (steps < 0) {
                throw new RangeError("Requested steps is negative (" + steps + ")");
            }
            verifyRootNode();
            stepsFromRoot = stepsCache.setToClosestStep(steps, iterator);

            while (stepsFromRoot < steps && iterator.nextPosition()) {
                isStep = filter.acceptPosition(iterator) === FILTER_ACCEPT;
                if (isStep) {
                    stepsFromRoot += 1;
                }
                updateCache(stepsFromRoot, iterator, isStep);
            }
            if (stepsFromRoot !== steps) {
                throw new RangeError("Requested steps (" + steps + ") exceeds available steps (" + stepsFromRoot + ")");
            }
            return {
                node: iterator.container(),
                offset: iterator.unfilteredDomOffset()
            };
        };

        /**
         * Uses the provided delegate to choose between rounding up or rounding down to the nearest step.
         * @param {!core.PositionIterator} iterator
         * @param {function(!core.StepDirection, !Node, !number):boolean=} roundDirection
         * @return {!boolean} Returns true if an accepted position is found, otherwise returns false.
         */
        function roundToPreferredStep(iterator, roundDirection) {
            if (!roundDirection || filter.acceptPosition(iterator) === FILTER_ACCEPT) {
                return true;
            }

            while (iterator.previousPosition()) {
                if (filter.acceptPosition(iterator) === FILTER_ACCEPT) {
                    if (roundDirection(PREVIOUS, iterator.container(), iterator.unfilteredDomOffset())) {
                        return true;
                    }
                    break;
                }
            }

            while (iterator.nextPosition()) {
                if (filter.acceptPosition(iterator) === FILTER_ACCEPT) {
                    if (roundDirection(NEXT, iterator.container(), iterator.unfilteredDomOffset())) {
                        return true;
                    }
                    break;
                }
            }

            return false;
        }

        /**
         * Convert the supplied DOM node & offset pair into it's equivalent steps from root
         * If the node & offset is not in an accepted location, the
         * roundDirection delegate is used to choose between rounding up or
         * rounding down to the nearest step. If not provided, the default
         * behaviour is to round down.
         * @param {!Node} node
         * @param {!number} offset
         * @param {function(!core.StepDirection, !Node, !number):!boolean=} roundDirection
         * @return {!number}
         */
        this.convertDomPointToSteps = function (node, offset, roundDirection) {
            var stepsFromRoot,
                beforeRoot,
                /**@type{!DomPoint}*/
                destination,
                rounding = 0,
                isStep;

            verifyRootNode();
            if (!domUtils.containsNode(rootNode, node)) {
                beforeRoot = domUtils.comparePoints(rootNode, 0, node, offset) < 0;
                node = /**@type{!Node}*/(rootNode);
                offset = beforeRoot ? 0 : /**@type{!Element}*/(rootNode).childNodes.length;
            }

            iterator.setUnfilteredPosition(node, offset);
            // if the user has set provided a rounding selection delegate, use that to select the previous or next
            // step if the (node, offset) position is not accepted by the filter
            if (!roundToPreferredStep(iterator, roundDirection)) {
                // The rounding selection delegate rejected both. Revert back to the previous step
                iterator.setUnfilteredPosition(node, offset);
            }

            // Get the iterator equivalent position of the current node & offset
            // This ensures the while loop will match the exact container and offset during iteration
            destination = new DomPoint(iterator);

            stepsFromRoot = stepsCache.setToClosestDomPoint(destination.container, destination.offset, iterator);
            if (destination.comparePositionTo(iterator) > 0) {
                // Special case: the requested DOM point is between the bookmark node and walkable step it represents
                return stepsFromRoot > 0 ? stepsFromRoot - 1 : stepsFromRoot;
            }

            while (!(destination.isEqualTo(iterator)) && iterator.nextPosition()) {
                isStep = filter.acceptPosition(iterator) === FILTER_ACCEPT;
                if (isStep) {
                    stepsFromRoot += 1;
                }
                updateCache(stepsFromRoot, iterator, isStep);
            }
            return stepsFromRoot + rounding;
        };

        /**
         * Iterates over all available positions starting at the root node and primes the cache
         * @return {undefined}
         */
        this.prime = function () {
            var stepsFromRoot,
                isStep;

            verifyRootNode();
            stepsFromRoot = stepsCache.setToClosestStep(0, iterator);
            while (iterator.nextPosition()) {
                isStep = filter.acceptPosition(iterator) === FILTER_ACCEPT;
                if (isStep) {
                    stepsFromRoot += 1;
                }
                updateCache(stepsFromRoot, iterator, isStep);
            }
        };

        /**
         * @param {!{position: !number}} eventArgs
         * @return {undefined}
         */
        this.handleStepsInserted = function (eventArgs) {
            verifyRootNode();
            // Old position = position
            // New position = position + length
            // E.g., {position: 10, length: 1} indicates 10 => 10, New => 11, 11 => 12, 12 => 13
            stepsCache.damageCacheAfterStep(eventArgs.position);
        };

        /**
         * @param {!{position: !number}} eventArgs
         * @return {undefined}
         */
        this.handleStepsRemoved = function (eventArgs) {
            verifyRootNode();
            // Old position = position + length
            // New position = position
            // E.g., {position: 10, length: 1} indicates 10 => 10, 11 => 10, 12 => 11

            // TODO OpRemoveText inaccurately reports the position making it necessary subtract 1
            // Paragraph merge behaviours might result in the paragraph exactly at the reported position being
            // replaced by a later paragraph. Conceptually, this means the last unmodified position is
            // actually 1 step prior to the replace paragraph.
            stepsCache.damageCacheAfterStep(eventArgs.position - 1);
        };

        function init() {
            verifyRootNode();
        }
        init();
    };
}());
