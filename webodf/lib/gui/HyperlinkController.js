/**
 * Copyright (C) 2013 KO GmbH <copyright@kogmbh.com>
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

/*global runtime, core, gui, Node, ops, odf */

/**
 * @constructor
 * @implements {core.Destroyable}
 * @param {!ops.Session} session
 * @param {!gui.SessionConstraints} sessionConstraints
 * @param {!gui.SessionContext} sessionContext
 * @param {!string} inputMemberId
 */
gui.HyperlinkController = function HyperlinkController(
    session,
    sessionConstraints,
    sessionContext,
    inputMemberId
    ) {
    "use strict";

    var odfUtils = new odf.OdfUtils(),
        odtDocument = session.getOdtDocument(),
        eventNotifier = new core.EventNotifier([
            gui.HyperlinkController.enabledChanged
        ]),
        /**@const*/
        SELECTED_TEXT_ONLY = gui.HyperlinkController.SELECTED_TEXT_ONLY,
        isEnabled = false;

    /**
     * @return {undefined}
     */
    function updateEnabledState() {
        var /**@type{!boolean}*/newIsEnabled = true;

        if (sessionConstraints.getState(gui.CommonConstraints.EDIT.REVIEW_MODE) === true) {
            newIsEnabled = /**@type{!boolean}*/(sessionContext.isLocalCursorWithinOwnAnnotation());
        }

        if (newIsEnabled !== isEnabled) {
            isEnabled = newIsEnabled;
            eventNotifier.emit(gui.HyperlinkController.enabledChanged, isEnabled);
        }
    }

    /**
     * @param {!ops.OdtCursor} cursor
     * @return {undefined}
     */
    function onCursorEvent(cursor) {
        if (cursor.getMemberId() === inputMemberId) {
            updateEnabledState();
        }
    }

    /**
     * @return {!boolean}
     */
    this.isEnabled = function () {
        return isEnabled;
    };

    /**
     * @param {!string} eventid
     * @param {!Function} cb
     * @return {undefined}
     */
    this.subscribe = function (eventid, cb) {
        eventNotifier.subscribe(eventid, cb);
    };

    /**
     * @param {!string} eventid
     * @param {!Function} cb
     * @return {undefined}
     */
    this.unsubscribe = function (eventid, cb) {
        eventNotifier.unsubscribe(eventid, cb);
    };

    /**
     * Insert a new hyperlink at the current position. This will *not* replace the current selection.
     *
     * TODO: currently doesn't support inserting a new hyperlink within an existing hyperlink
     *
     * @param {!string} hyperlink Hyperlink to insert
     * @param {!string=} insertionText Optional text to insert as the text content for the hyperlink.
     *  If unspecified, the hyperlink text will be inserted as the display text.
     */
    function insertHyperlink(hyperlink, insertionText) {
        if (!isEnabled) {
            return;
        }
        var selection = odtDocument.getCursorSelection(inputMemberId),
            insertTextOp = new ops.OpInsertText(),
            applyHyperlinkOp = new ops.OpApplyHyperlink();

        // FIXME currently doesn't cope if the new hyperlink + display text is within an existing hyperlink
        insertionText = insertionText || hyperlink;
        insertTextOp.init({
            memberid: inputMemberId,
            position: selection.position,
            text: insertionText
        });
        selection.length = insertionText.length;

        applyHyperlinkOp = new ops.OpApplyHyperlink();
        applyHyperlinkOp.init({
            memberid: inputMemberId,
            position: selection.position,
            length: selection.length,
            hyperlink: hyperlink
        });
        session.enqueue([insertTextOp, applyHyperlinkOp]);
    }
    this.insertHyperlink = insertHyperlink;

    /**
     * Remove hyperlinks within the current selection
     * @param {!boolean} selectionOnly When true, only remove hyperlinks from selected text. Otherwise,
     *      completely remove any hyperlinks that intersect with the current selection.
     * @return {!Array.<!ops.Operation>}
     */
    function createRemoveHyperlinkOps(selectionOnly) {
        var iterator = gui.SelectionMover.createPositionIterator(odtDocument.getRootNode()),
            selectedRange = odtDocument.getCursor(inputMemberId).getSelectedRange(),
            links = odfUtils.getHyperlinkElements(selectedRange),
            domRange = odtDocument.getDOMDocument().createRange(),
            operations = [],
            /**@type{{position: !number, length: number}}*/
            cursorRange,
            firstLink, lastLink, offset, op;

        if (links.length === 0) {
            return operations;
        }

        // Remove any links that overlap with the current selection
        links.forEach(function (link) {
            domRange.selectNodeContents(link);
            cursorRange = odtDocument.convertDomToCursorRange({
                anchorNode: /**@type{!Node}*/(domRange.startContainer),
                anchorOffset: domRange.startOffset,
                focusNode: /**@type{!Node}*/(domRange.endContainer),
                focusOffset: domRange.endOffset
            });
            op = new ops.OpRemoveHyperlink();
            op.init({
                memberid: inputMemberId,
                position: cursorRange.position,
                length: cursorRange.length
            });
            operations.push(op);
        });

        if (selectionOnly === SELECTED_TEXT_ONLY) {
            // Re-add any leading or trailing links that were only partially selected
            firstLink = /**@type{!Element}*/(links[0]);
            if (selectedRange.comparePoint(firstLink, 0) === -1) {
                domRange.setStart(firstLink, 0);
                domRange.setEnd(selectedRange.startContainer, selectedRange.startOffset);
                cursorRange = odtDocument.convertDomToCursorRange({
                    anchorNode: /**@type{!Node}*/(domRange.startContainer),
                    anchorOffset: domRange.startOffset,
                    focusNode: /**@type{!Node}*/(domRange.endContainer),
                    focusOffset: domRange.endOffset
                });
                if (cursorRange.length > 0) {
                    op = new ops.OpApplyHyperlink();
                    /**@type{!ops.OpApplyHyperlink}*/(op).init({
                        memberid: inputMemberId,
                        position: cursorRange.position,
                        length: cursorRange.length,
                        hyperlink: odfUtils.getHyperlinkTarget(firstLink)
                    });
                    operations.push(op);
                }
            }
            lastLink = /**@type{!Element}*/(links[links.length - 1]);
            iterator.moveToEndOfNode(lastLink);
            offset = iterator.unfilteredDomOffset();
            if (selectedRange.comparePoint(lastLink, offset) === 1) {
                domRange.setStart(selectedRange.endContainer, selectedRange.endOffset);
                domRange.setEnd(lastLink, offset);
                cursorRange = odtDocument.convertDomToCursorRange({
                    anchorNode: /**@type{!Node}*/(domRange.startContainer),
                    anchorOffset: domRange.startOffset,
                    focusNode: /**@type{!Node}*/(domRange.endContainer),
                    focusOffset: domRange.endOffset
                });
                if (cursorRange.length > 0) {
                    op = new ops.OpApplyHyperlink();
                    /**@type{!ops.OpApplyHyperlink}*/(op).init({
                        memberid: inputMemberId,
                        position: cursorRange.position,
                        length: cursorRange.length,
                        hyperlink: odfUtils.getHyperlinkTarget(lastLink)
                    });
                    operations.push(op);
                }
            }
        }

        return operations;
    }

    /**
     * Remove hyperlinks within the current selection, or intersecting the current selection based on
     * the supplied boolean.
     *
     * @param {!boolean} selectionOnly When true, only remove hyperlinks from selected text. Otherwise,
     *      completely remove any hyperlinks that intersect with the current selection.
     * @return {undefined}
     */
    this.removeHyperlinks = function(selectionOnly) {
        if (!isEnabled) {
            return;
        }
        session.enqueue(createRemoveHyperlinkOps(selectionOnly));
    };

    /**
     * Set (or replace) the hyperlink for the current selection
     * @param {!string} hyperlink
     * @return {undefined}
     */
    this.setHyperlinkForSelection = function(hyperlink) {
        if (!isEnabled) {
            return;
        }
        var selection = odtDocument.getCursorSelection(inputMemberId),
            operations,
            op;

        runtime.assert(selection.length > 0, "Can't call setHyperlink on a collapsed selection");
        operations = createRemoveHyperlinkOps(SELECTED_TEXT_ONLY);

        op = new ops.OpApplyHyperlink();
        op.init({
            memberid: inputMemberId,
            position: selection.position,
            length: selection.length,
            hyperlink: hyperlink
        });
        operations.push(op);
        session.enqueue(operations);
    };

    /**
     * @param {!function(!Error=)} callback passing an error object in case of error
     * @return {undefined}
     */
    this.destroy = function (callback) {
        odtDocument.unsubscribe(ops.Document.signalCursorMoved, onCursorEvent);
        sessionConstraints.unsubscribe(gui.CommonConstraints.EDIT.REVIEW_MODE, updateEnabledState);
        callback();
    };

    function init() {
        odtDocument.subscribe(ops.Document.signalCursorMoved, onCursorEvent);
        sessionConstraints.subscribe(gui.CommonConstraints.EDIT.REVIEW_MODE, updateEnabledState);
        updateEnabledState();
    }
    init();
};

/**@const*/gui.HyperlinkController.enabledChanged = "enabled/changed";

/**
 * Remove any hyperlinks that intersect with the current selection.
 * @const
 * @type {!boolean}
 */
gui.HyperlinkController.INTERSECTING_LINKS = false;

/**
 * Remove hyperlinks only from text contained within the current selection.
 * @const
 * @type {!boolean}
 */
gui.HyperlinkController.SELECTED_TEXT_ONLY = true;
