# Virtual Scrolling Tree

Virtual scrolling tables are an easy problem to solve. If you know how many rows there are in a table, you can easily map the scrollbar position to a row index and slice the data of the table to show that index. For trees however, it's a significantly more complicated problem. With trees, you have items that can expand and change the total scroll height, and the parent for an item that isn't necessarily visible or in the DOM as you're scrolling. There's also asynchronous situations where you might want to connect to a server and download a partial amount of the data, which may or may not include parents.

This project provides a vanilla JavaScript implementation of a virtual scrolling tree. It's also designed to be easily wrapped by third-party frameworks (see examples folder), so no matter which project you're working on, you should always be able to use this library to power virtual scrolling trees.

## Demo

[Live Demo](http://pepsryuu.github.io/demo/vst/)

## Getting Started

Install the package. The package provides many different formats depending on your tool setup.

```
npm install virtual-scrolling-tree-es
```

Assuming you're using ES6, you can then import the package.

```
import VirtualScrollingTree from 'virtual-scrolling-tree-es';
```

## Running Examples

Examples are stored in the ```examples``` folder. To run them run:

```
npm start
```

And then visit the following:

```
http://localhost:8585/examples/preact/index.html
```

## Constructor Options

| Type          | Name             | Description |
|---------------|---------------   |-------------|
| `HTMLElement` | `parent`         | The element to instantiate this component into. |
| `Number`      | `totalRootItems` | The starting number of items must be known. |
| `Number`      | `itemHeight`     | Pixel size of each item in the tree. Must always be the same.|
| `Function`    | `onItemRender`   | Called for each item. Passes the target element and metadata about the item it's rendering. |
| `Function`    | `onDataFetch`    | Called when there's a need for data. |
| `String`      | `scrollbarClass` | Optional scrollbar CSS class if you have a custom scrollbar. |
| `Boolean`     | `smoothScrolling`| Optional, if enabled, smoothly scrolls to look more native instead of shifting rows. Might not be suitable when using asynchronous onDataFetch. |
| `String`      | `diffMode`       | Optional, by default is set to `hard` which wipes all rows and re-renders them. If set to `soft` where it will check which elements are updating. Those elements are not removed, but you must update them yourself.|


## onItemRender

The following properties are passed into the onItemRender callback:

| Type       | Name       | Description |
|------------|------------|-------------|
| `String`   | `id`       | The id of the item. This will be used to reference the item by the component. |
| `Number`   | `children` | The amount of children this item has. When an item is toggled it will use this number to determine how many to fetch. |
| `String`   | `parent`   | Contains the id of the parent. If it's the root, the value will be `null`. |
| `Boolean`  | `expanded` | If true, the item is in an expanded state. |
| `Number`   | `indent`   | Represents how indented this item should be. |
| `Function` | `toggle`   | Call this function to expand/collapse the item. |

Custom properties will also be passed in.

```
onItemRender: (element, item, updating) => {
    element.innerHTML = `
        <div class="Item">
            <div style="padding-left: ${item.indent * 20}px" />
            <div>{item.data.children? (item.expanded? '-' : '+') : ''}</div>
            <div>{item.data.label}</div>
        </div>
    `;

    element.children[0].addEventListener('click', item.toggle);
}
```

"updating" is passed as true if you're using "soft" as the "diffMode".

## onDataFetch

Provides a query array with multiple requests to be fulfilled, and a resolve function.
This function can operate asynchronously if it wants to. 
If resolve is called immediately it's synchronous.

### Example

```
onDataFetch: (query, resolve) {
    resolve(getData(query));
}
```

### Query Objects

Query objects contain the following:

| Type     | Name     | Description |
|----------|----------|-------------|
| `String` | `parent` | Contains the id of the parent. If it's the root, the value will be `null`. |
| `Number` | `offset` | When fetching the children for this parent, start from this offset rather than the beginning. |
| `Number` | `limit`  | Fetch this amount of children from the offset. |

```
{
    "parent": "123",
    "offset": 5,
    "limit": 10
}
```

### Query Responses

Query responses must be given in the form of an array, and must match the same order as the query objects. The following are the expected properties for query responses:

| Type            | Name     | Description |
|-----------------|----------|-------------|
| `String`        | `parent` | The parent id, if it's the root, the parent is `null`. |
| `Array<Object>` | `items`  |  Array of items. |

Items must have the following properties:

| Type     | Name       | Description |
|----------|------------|-------------|
| `String` | `id`       | The id of the item. This will be used to reference the item by the component. |
| `Number` | `children` | The amount of children this item has. When an item is toggled it will use this number to determine how many to fetch. |

Items can have additional properties which you can use for your own rendering purposes.
Please be advised that you should keep your custom properties namespaced to avoid future compatibility issues.

## Methods 

| Method           | Parameters   | Description |
|------------------|--------------|-------------|
| `redraw`         |              | Redraw the component. If layout is changing without the resizing of the window, you'll need to call this function. |
| `destroy`        |              | Clean up the component. |
| `expand`         | `item:Item` | Expands the specified item. See below for Item description. |
| `collapse`       | `item:Item` | Collapses the specified item. See below for Item description. |
| `isItemExpanded` | `item:Item` | Returns the expansion status of an item with children (user should check first). See below for Item description. |
| `scrollIntoView` | `item:Item`, `[options:Object]` | Scrolls to the specified item. See below for Item description. Options accepts `align` which can either be `"start"` or `"end"`, which will align the item to the top or bottom of the viewport. |
| `updateData`     | `numRootItems: number`, `parentsMap: Map<string, VT_Item>` | Allows you to update the grid contents while preserving any expansions that are still valid |

### Item Object

| Type     | Name       | Description |
|----------|------------|-------------|
| `String` | `parent`   | The parent id of this item. |
| `String` | `id`       | The id of this item. |
| `Number` | `offset`   | Relative to the parent, starting from 0, the index of this item. |
| `Number` | `children` | The number of children this item has. |

Used by the methods above. If any of these properties are incorrect, it will result in incorrect rendering.
