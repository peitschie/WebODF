/*global define,require,document */

define("webodf/editor/widgets/tableOperations", [], function() {
    "use strict";
    function addIfMissing(editorSession, styleInfo) {
        if (!editorSession.getStyleElement(styleInfo['style:name'], styleInfo['style:family'])) {
            editorSession.createStyle('automatic', styleInfo);
        }
    }

    function makeWidget(editorSession, callback) {
        require(["dijit/form/Button"], function (Button) {
            var styleCreated = false,
                widget = new Button({
                name: "insertTable",
                label: document.translator("insertTable"),
                onClick: function() {
                    if (!styleCreated) {
                        addIfMissing(editorSession, {
                            "style:name": 'Table1',
                            "style:family": 'table',
                            "style:table-properties" : {
                                "style:width": "17cm",
                                "table:align": "margin",
                                "table:border-model": "collapsing"
                            }
                        });
                        addIfMissing(editorSession, {
                            "style:name": 'Table1.A',
                            "style:family": 'table-column',
                            "style:table-column-properties" : {
                                "style:rel-column-width": "1*"
                            }
                        });
                        addIfMissing(editorSession, {
                            "style:name": 'Table1.A1',
                            "style:family": 'table-cell',
                            "style:table-cell-properties" : {
                                "fo:border-left": "0.05pt solid #000000",
                                "fo:border-right": "none",
                                "fo:border-top": "0.05pt solid #000000",
                                "fo:border-bottom": "0.05pt solid #000000"
                            }
                        });
                        addIfMissing(editorSession, {
                            "style:name": 'Table1.D1',
                            "style:family": 'table-cell',
                            "style:table-cell-properties" : {
                                "fo:border": "0.05pt solid #000000"
                            }
                        });
                        addIfMissing(editorSession, {
                            "style:name": 'Table1.A2',
                            "style:family": 'table-cell',
                            "style:table-cell-properties" : {
                                "fo:border-left": "0.05pt solid #000000",
                                "fo:border-right": "none",
                                "fo:border-top": "none",
                                "fo:border-bottom": "0.05pt solid #000000"
                            }
                        });
                        addIfMissing(editorSession, {
                            "style:name": 'Table1.D2',
                            "style:family": 'table-cell',
                            "style:table-cell-properties" : {
                                "fo:border-left": "0.05pt solid #000000",
                                "fo:border-right": "0.05pt solid #000000",
                                "fo:border-top": "none",
                                "fo:border-bottom": "0.05pt solid #000000"
                            }
                        });
                        styleCreated = true;
                    }

                    editorSession.insertTable(3, 4, 'Table1', 'Table1.A',
                        [['Table1.A1', 'Table1.A1', 'Table1.D1'],
                         ['Table1.A2', 'Table1.A2', 'Table1.D2'],
                         ['Table1.A2', 'Table1.A2', 'Table1.D2']]
                    );
                }
            });
            callback(widget);
        });
    }

    return function TableOperations(editorSession, callback) {
        makeWidget(editorSession, function (widget) {
            return callback(widget);
        });
    };
});