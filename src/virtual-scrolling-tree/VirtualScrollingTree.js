/**
 * Load the styles required for this to work.
 */
let style = document.createElement('style');
style.textContent = `
    .VirtualScrollingTree {
        overflow-y: hidden;
        white-space: nowrap;
    }

    .VirtualScrollingTree-content {
        display: inline-block;
        vertical-align: top;
    }

    .VirtualScrollingTree-scrollbar {
        overflow-y: auto;
        display: inline-block;
        vertical-align: top;
        height: 100%;
    }

    .VirtualScrollingTree-scrollbarContent {
        width: 1px;
        visibility: hidden;
        display: inline-block;
        vertical-align: top;
    }
`;
document.head.appendChild(style);

/**
 * Private variable storage.
 */
let store = new WeakMap();
const _ = (function () {
    return function (inst) {
        let obj = store.get(inst);

        if (!obj) {
            obj = {};
            store.set(inst, obj);
        };

        return obj;
    }; 
})();

/**
 * Public Virtual Scrolling Tree class.
 *
 * @class VirtualScrollingTree
 */
export default class VirtualScrollingTree {

    constructor (options) {
        _(this).items = [];
        _(this).expansions = [{
            id: null,
            children: options.totalRootItems,
            offset: 0,
            expansions: []
        }];

        _(this).onItemRender = options.onItemRender;
        _(this).itemHeight = options.itemHeight;
        _(this).onDataFetch = options.onDataFetch;
        _(this).parent = options.parent;
        _(this).scrollbarClass = options.scrollbarClass || '';
        _(this).smoothScrolling = options.smoothScrolling || false;
        _(this).diffMode = options.diffMode || 'hard';

        this.redraw = this.redraw.bind(this);
        this.expand = this.expand.bind(this);
        this.collapse = this.collapse.bind(this);
        this.updateData = this.updateData.bind(this);
        this.isItemExpanded = this.isItemExpanded.bind(this);

        window.addEventListener('resize', this.redraw);
        prepareView.call(this);
        this.redraw();
    }

    updateExpansion(expansion, parentsMap) {
        const findParent = parentsMap.get(expansion.id);
        if (findParent) {
            expansion.children = findParent.children;
            expansion.parent = findParent.parent;
            expansion.offset = findParent.offset;
        }
        const valid = expansion.expansions.filter((exp) => { return parentsMap.has(exp.id) }) || [];
        valid.forEach((exp) => { this.updateExpansion(exp, parentsMap)} );
        expansion.expansions = valid;
    }

    // Update only the data-specific members from a new root count and a map of valid ids (to preserve expansions)
    updateData (numRootItems, parentsMap) {
        _(this).expansions[0].children = numRootItems;
        this.updateExpansion(_(this).expansions[0], parentsMap);    
        this.redraw();
    }
    
    redraw () {
        requestData.call(this);
    }

    isItemExpanded (item) {
        return isExpanded.call(this, item.id);
    }

    expand (item) {
        if (item.children) {
            if (!isExpanded.call(this, item.parent)) {
                throw new Error('Parent ' + item.parent + ' must be collapsed to expand ' + item.id);
            }
    
            if (!isExpanded.call(this, item.id)) {
                expandItem.call(this, item);
                requestData.call(this);
            }
        }
    }
    
    collapse (item) {
        if (item.children) {
            if (!isExpanded.call(this, item.parent)) {
                throw new Error('Parent ' + item.parent + ' must be expanded to collapse ' + item.id);
            }

            if (isExpanded.call(this, item.id)) {
                collapseItem.call(this, item);
                requestData.call(this);
            }
        }
    }

    scrollIntoView (item, options = { align: 'start' }) {
        if (!isExpanded.call(this, item.parent)) {
            throw new Error('Parent ' + item.parent + ' must be expanded to scroll ' + item.id + ' into the view');
        }

        let parent = findExpansion.call(this, item.parent);

        // This can get a bit complicated depending on the scenario.
        // If there's no item expanded with the same parent but a lower
        // offset, then the algorithm is simply _start + offset.
        // However, if there is an item expanded, we need to get the _end
        // value of that item, and add the difference in offset.
        //
        // 0 Item 0 <-- 
        // 1 Item 1 <-- _start 2, _end 6
        // 2    Item 1.0 <-- offset 0
        // 3    Item 1.1 <-- start 4, end 5, offset 1
        // 4       Item 1.1.0
        // 5       Item 1.1.1
        // 6    Item 1.2 <-- Here we want to go
        //
        // In this example, if Item 1.1 was not expanded, to get
        // to Item 1.2, it would be:
        // 
        // (Item 1)._start + (Item 1.2).offset
        // = 2 + 2 = 4
        // 
        // On the other hand, if Item 1.1 was expanded:
        //
        // (Item 1.1)._end + (Item 1.2).offset - (Item 1.1).offset
        // = 5 + 2 - 1 = 6
        // 
        // So it works out according to the absolute index.
        let above = parent.expansions.filter(e => {
            return e.offset < item.offset;
        }).pop();

        let scrollTop;
        if (above) {
            scrollTop = above._end + item.offset - above.offset;
        } else {
            scrollTop = parent._start + item.offset;
        }

        if (options.align === 'end') {
            // Subtract the total number of visible items minus one.
            scrollTop -= Math.floor(_(this).parent.offsetHeight / _(this).itemHeight) - 1;
        }

        _(this).view.scrollbar.scrollTop = scrollTop * _(this).itemHeight;
    }

    destroy () {
        window.removeEventListener('resize', this.redraw);
        _(this).el.remove();
    }
}

/**
 * Creates a shortcut view object which we can use to access
 * our DOM elements. Also sets up event handlers for the content.
 *
 * @method prepareView
 * @private
 */
function prepareView() {
    _(this).el = document.createElement('div');
    _(this).el.setAttribute('class', 'VirtualScrollingTree');

    let contentDiv = `<div class="VirtualScrollingTree-content"></div>`;

    _(this).el.innerHTML = `
        ${_(this).smoothScrolling? '' : contentDiv}
        <div class="VirtualScrollingTree-scrollbar ${_(this).scrollbarClass}">
            ${_(this).smoothScrolling? contentDiv : ''}
            <div class="VirtualScrollingTree-scrollbarContent"></div>
        </div>
    `.replace(/\n\s+/g, '');

    _(this).view = {
        content: _(this).el.querySelector('.VirtualScrollingTree-content'),
        scrollbar:  _(this).el.querySelector('.VirtualScrollingTree-scrollbar'),
        scrollbarContent: _(this).el.querySelector('.VirtualScrollingTree-scrollbarContent')
    };

    if (!_(this).smoothScrolling) {
        _(this).view.content.addEventListener('wheel', e => {
            _(this).view.scrollbar.scrollTop += e.deltaY;
        }, true);
    } 

    // Scrolling either the content with the middle mouse wheel, or manually
    // scrolling the scrollbar directly should accomplish the same thing.
    // Note it's important for this to come after the transform above.
    // If it's not, when the DOM is being manipulated the scrollbar will jump.
    let lastScrollTop = 0;
    _(this).view.scrollbar.addEventListener('scroll', (e) => {
        if (_(this).scrollLocked) {
            return;
        }

        let newScrollTop = parseInt(_(this).view.scrollbar.scrollTop / _(this).itemHeight);

        if (lastScrollTop !== newScrollTop) {
            lastScrollTop = newScrollTop;
            if (_(this).smoothScrolling) {
                _(this).view.content.style.transform = `translateY(${newScrollTop * _(this).itemHeight}px)`;
            }

            requestData.call(this);
        }
    }, true);

    _(this).parent.appendChild(_(this).el);
}    

/**
 * Updates the width of the tree to match its containing element.
 *
 * @method updateViewDimensions
 * @private
 */
function updateViewDimensions(totalItems) {
    let visibleItems = Math.floor(_(this).parent.offsetHeight / _(this).itemHeight);

    _(this).view.scrollbar.style.height = visibleItems * _(this).itemHeight + 'px';
    _(this).view.scrollbarContent.style.height = totalItems * _(this).itemHeight + 'px';
    
    let scrollbarWidth = totalItems < visibleItems? 0 : getNativeScrollbarWidth.call(this);
    
    if (!_(this).smoothScrolling) {
        _(this).view.content.style.width = Math.floor(_(this).el.getBoundingClientRect().width) - scrollbarWidth - 1 + 'px';
        _(this).view.scrollbar.style.width = scrollbarWidth + 1 + 'px';
        // Not needed for smooth
        _(this).view.content.style.height = visibleItems * _(this).itemHeight + 'px';
    } else {
        _(this).view.scrollbar.style.width = '100%';
        _(this).view.content.style.width = 'calc(100% - 1px)';
    }
}

/**
 * Creates a div which is used to calculate the width
 * of the scrollbar for the current browser.
 *
 * @method getNativeScrollbarWidth
 * @private
 * @return {number}
 */
function getNativeScrollbarWidth() {
    let outer = document.createElement('div');
    outer.style.overflowY = 'scroll';
    outer.setAttribute('class', _(this).scrollbarClass);
    outer.style.visibility = 'hidden';
    outer.style.width = '100px';
    document.body.appendChild(outer);
    let content = document.createElement('div');
    outer.appendChild(content);
    var width = 100 - Math.floor(content.getBoundingClientRect().width);
    document.body.removeChild(outer);
    return width;
}

 /**
 * Builds query, and triggers the onDataFetch call for the developer.
 * When the developer calls success the data of the tree gets updated.
 *
 * @method requestData
 * @private
 */
function requestData() {
    let visible = Math.ceil(_(this).parent.offsetHeight / _(this).itemHeight);
    let scrollIndex = Math.floor(_(this).view.scrollbar.scrollTop / _(this).itemHeight);
    let request = buildRequest.call(this, scrollIndex, visible);
    _(this).request = request;
    _(this).onDataFetch(request, setData.bind(this));
}

/**
 * Figures out where to draw all of the items based on expanded, scroll position
 * and other pieces of information.
 *
 * @method setData
 * @private
 * @param {Array<Object>} data
 */
function setData(data) {
    let output = [];

    // Clone so that we have our own reference
    data = JSON.parse(JSON.stringify(data));
    
    // Calculate the total height that the scrollbar should be based on the root nodes
    // and all of the items that have been expanded so far.
    let totalHeight = 0;
    forEachExpansion(_(this).expansions, (expansion) => {
        totalHeight += expansion.children;
    });

    updateViewDimensions.call(this, totalHeight);

    // Apply the offsets to the items which is used to keep track of expansions.
    // By ensuring the data has the offset applied to them, we can calculate from
    // here exactly which items are above us and which ones are below us when we 
    // look at the position of the virtual scrollbar.
    for (let i = 0; i < data.length; i++) {
        for (let j = 0; j < data[i].items.length; j++) {
            let item = data[i].items[j];
            item.original = JSON.parse(JSON.stringify(item));
            item.offset = _(this).request[i].offset + j;
            item.parent = data[i].parent;
        }
    }

    // The response from the server should be in a heirarchical structure.
    // This means that we can iterate over this array, and the further we are in the array
    // the deeper the level we're in. 
    //
    // Eg. [null, 1, 1, 2, 3, 3]
    data.forEach((response) => {
        let index = output.findIndex((obj) => {
            return obj.id === response.parent;
        });

        if (index > -1) {
            // If the parent exists, we insert the items directly below it.
            output = output.slice(0, index + 1)
                        .concat(response.items)
                        .concat(output.slice(index + 1));
        } else {
            // If the parent doesn't exist, we prepend. We prepend because of this scenario:
            //
            //       Item 1.1.1
            //    Item 1.2
            //    Item 1.3
            //    Item 1.4
            // Item 2
            // Item 3
            // 
            // In this scenario, we've expanded Item 1, but because it doesn't exist in the output
            // we can only assume it's directly above us. We've also expanded Item 1.1, and again
            // because it's parent isn't visible, and because we know the data is in a heirarchical 
            // structure, we can prepend it.
            output = response.items.concat(output);
        }
    });


    if (_(this).items.length === 0 || _(this).diffMode === 'hard') {
        // Wipe out all of the current items since we don't need them anymore.
        // Easier code wise to just re-instantiate everything and doesn't impact performance.
        while (_(this).items.length) {
            _(this).items.pop().el.remove();
        }


        // Once we've figured out the output, start rendering them
        output.forEach((data) => {
            let item = createItem.call(this, data);
            _(this).view.content.appendChild(item.el);
            _(this).items.push(item);
        });
    } else if (_(this).diffMode === 'soft') {
        // First check what's common, and run updates.
        // We'll also discover what isn't common and therefore track them for removal.
        let removals = [];
        let updated = [];
        _(this).items.forEach((item, index) => {
            let found = false;
            for (let i = 0; i < output.length; i++) {
                if (output[i].id === item.id) {
                    renderItem.call(this, item.el, output[i], true);
                    updated.push(i);
                    found = true;
                    break;
                }
            } 

            if (!found) {
                removals.push(index);
            }
        });

        // Lock the scroll events and track scroll position.
        // When we're adding and removing items, they can adjust
        // the scroll position. So after we made the updates we
        // need to restore the scroll position.
        let oldScrollTop = _(this).view.scrollbar.scrollTop;
        _(this).scrollLocked = true;

        // Remove the items.
        for (let i = removals.length - 1; i >= 0; i--) {
            let index = removals[i];
            _(this).items[index].el.remove();
            _(this).items.splice(index, 1);
        }

        // Insert all of the new items.
        for (let i = 0; i < output.length; i++) {
            if (updated.indexOf(i) === -1) {
                let item = createItem.call(this, output[i]);
                 _(this).view.content.insertBefore(item.el, _(this).view.content.children[i]);
                 _(this).items.splice(i, 0, item);
            }
        }

        // TODO: This can cause a weird slow scrolling bug in Chrome when scrolling up.
        // Was triggered by console.log, could be a latency issue.
        _(this).view.scrollbar.scrollTop = oldScrollTop;
        _(this).scrollLocked = false;
    }
}

/**
 * Calls the onItemRender option.
 *
 * @method renderItem
 * @private
 * @param {HTMLElement} element
 * @param {Object} data
 * @param {Boolean} updating
 */
function renderItem (element, data, updating) {
    _(this).onItemRender(element, {
        ...data.original,
        expanded: isExpanded.call(this, data.id),
        indent: calculateLevel.call(this, data),
        toggle: () => {
            // Check to see if this item is expanded or not
            let expanded = isExpanded.call(this, data.id);
            if (expanded) {
                collapseItem.call(this, data);
            } else {
                expandItem.call(this, data);
            }

            // Each time we expand or collapse we need to re-request data.
            requestData.call(this);
        }
    }, updating);
}

/**
 * Creates a HTMLElement to render an item into.
 *
 * @method createItem
 * @private
 * @param {Object} data
 * @return {Object}
 */
function createItem (data) {
    let itemEl = document.createElement('div');
    itemEl.setAttribute('class', 'VirtualScrollingTree-item');

    renderItem.call(this, itemEl, data);

    return {
        id: data.id,
        el: itemEl
    };
}

/**
 * Recursively iterate over the expansions and 
 * execute the passed callback against it.
 *
 * @method forEachExpansion
 * @private
 * @param {Array<Object>} expansions
 * @param {Functin} fn
 */
function forEachExpansion(expansions, fn) {
    let impl = function(expansions) {
        expansions.forEach((expansion) => {
            fn(expansion);
            impl(expansion.expansions);
        });
    };

    impl(expansions);
}

/**
 * Finds the expansion with the id specified.
 *
 * @method findExpansion     
 * @private
 * @param {String} id
 * @return {Object}
 */
function findExpansion(id) {
    let result;

    forEachExpansion(_(this).expansions, (expansion) => {
        if (expansion.id === id) {
            result = expansion;
        }
    });

    return result; 
}

/**
 * Calculates how deep the item is in the tree.
 *
 * @method calculateLevel
 * @private
 * @param {Object} item
 * @return {Number} level
 */
function calculateLevel(item) {
    return findExpansion.call(this, item.parent, _(this).expansions)._level;
}

/**
 * If expanded, returns true.
 *
 * @method isExpanded
 * @private
 * @param {String} id
 * @return {Boolean} inside
 */
function isExpanded(id) {
    return findExpansion.call(this, id) !== undefined;
}

/**
 * Removes item to list of expansions.
 *
 * @method collapseItem
 * @private
 * @params {Object} data
 */
function collapseItem(data) {
    let parentExpansions = findExpansion.call(this, data.parent).expansions;

    let index = parentExpansions.findIndex((expansion) => {
        return expansion.id === data.id;
    });

    parentExpansions.splice(index, 1);
}

/**
 * Adds item to list of expansions.
 *
 * @method expandItem
 * @private
 * @params {Object} data
 */
function expandItem(data) {
    // Cloning to avoid modification of the original data item.
    data = JSON.parse(JSON.stringify(data));

    if (!data.expansions) {
        data.expansions = [];
    }

    // Expansions are stored in a tree structure.
    let obj = findExpansion.call(this, data.parent);
    obj.expansions.push(data);
}

/**
 * Sorting expansions makes the query more accurate.
 *
 * @method sortExpansions
 * @private
 */
function sortExpansions() {
    let impl = function(expansions) {
        expansions.sort((a, b) => {
            return a.offset - b.offset;
        });
        
        for (let i = 0; i < expansions.length; i++) {
            impl(expansions[i].expansions);
        }
    }

    impl(_(this).expansions);
}

/**
 * Sorts and calculates the scroll indexes for the expansions.
 *
 * @method calculateExpansions
 * @private
 */
function calculateExpansions() {
    let impl = function(expansions, parentStart, parentLevel) {
        expansions.forEach((expansion, index) => {
            expansion._level = parentLevel;

            // We need to calculate the start position of this expansion. The start
            // position isn't just the offset of the item relative to the parent, but
            // also takes into account expanded items above it. 
            //
            // One easy way to do this is to just check the previous item and get its end index.
            // We fetch the one on the same level not above or below. That should in theory
            // already have a start/end relative to the parent. If there isn't a previous sibling
            // then we will take the parent start value. Add onto this the offset for the item
            // and we've got our starting value.
            //
            // eg. 
            //   Item 1 <-- start 0, end 0
            //   Item 2 <-- start 2, end 8
            //       Item 2.1 <-- start 3, end 3
            //          Item 2.1.1
            //       Item 2.2
            //       Item 2.3 <-- start 6, end 6
            //          Item 2.3.1
            //       Item 2.4 <-- start 8, end 8
            //          Item 2.4.1 
            //   Item 3
            //   Item 4 <-- start 11, end 12
            //       Item 4.1
            //       Item 4.2
            let start, end;
            let prevSibling = expansions[index - 1];
            if (prevSibling) {
                start = prevSibling._end + 1 + (expansion.offset - prevSibling.offset);
            } else {
                start = parentStart + 1 + expansion.offset;
            }

            expansion._start = start;

            // To calculate the ending, we recursively add the children
            // for this expansion, and that will be added to the start value.
            let totalChildren = expansion.children;
            forEachExpansion(expansion.expansions, (expansion) => {
                totalChildren += expansion.children;
            });

            // We add the children and substract one. We subtract one because
            // the start is one of the children.
            expansion._end = expansion._start + totalChildren - 1;

            // Repeat this recursively for all of the nested expansions.
            // The nested expansions will have a relative start to this 
            // expansion.
            impl(expansion.expansions, expansion._start, parentLevel + 1);
        });
    }

    impl(_(this).expansions, -1, 0);
}

/**
 * Calculates what's in the viewport and generates a series
 * of queries for the developer to respond to.
 *
 * @method buildRequest
 * @private
 */
function buildRequest(scrollPos, viewport) {
    // Variables
    let queries = [];
    let requestedTotal = 0;
    let expanded = _(this).expansions;

    sortExpansions.call(this);
    calculateExpansions.call(this);

    // One-dimensional collision detection. 
    // It checks to see if start/end are both either before 
    // the viewport, and after. If it's not before or after, it's colliding.
    let inViewPort = function(v1, v2, e1, e2) {
        return !((e1 < v1 && e2 < v1) || (e1 > v2 && e2 > v2));
    };

    let calculateExpansionQueries = function(expansions, parentQuery) {

        expansions.forEach((e) => {

            if (inViewPort(scrollPos, scrollPos + viewport, e._start, e._end)) {
                
                // We want to find out how many items for this expansion are 
                // visible in the view port. To do this we find the first item that's
                // visible, the last item that's visible, subtract them and cap it to the viewport size.
                let start = Math.max(scrollPos, e._start);
                let end = Math.min(scrollPos + viewport - 1, e._end);
                let visible = Math.max(0, Math.min(end - start + 1, viewport));

                if (parentQuery) {
                    // If there are nested children visible, we need to subtract 
                    // this from the parent. Note that visible also includes any expanded
                    // children nested further because we're using the _start and _end 
                    // values we've already calculated.
                    parentQuery.limit -= visible;

                    if (scrollPos > e._start) {
                        let notVisible = (e._end - e._start + 1) - visible;
                        if (notVisible > 0) {
                            parentQuery.offset -= notVisible;
                        }
                    }
                }

                // This query object is what's given to the end user.
                // The parent represents who we want the children of.
                // The offset is based on how much we've scrolled past the beginning.
                // The limit is total items that are visible in the viewport.
                let query = {
                    parent: e.id,
                    offset: scrollPos > e._start? scrollPos - e._start : 0,
                    limit: Math.min(visible, viewport)
                };

                queries.push(query);
                calculateExpansionQueries(e.expansions, query);
            } else if (scrollPos > e._end && parentQuery) {
                // If we've completely scrolled past this object, just substract all of its expanded children from the parent offset.
                parentQuery.offset -= (e._end - e._start + 1);
            }
            
        });
    };
    
    calculateExpansionQueries(_(this).expansions);
    return queries;

}