import { RouteMeta } from 'vue-router'
import { CustomRouteBlock } from './customBlock'
import { type TreeNode } from './tree'
import { warn } from './utils'

/**
 * A route node that can be modified by the user. The tree can be iterated to be traversed.
 * @example
 * ```js
 * [...node] // creates an array of all the children
 * for (const child of node) {
 *   // do something with the child node
 * }
 * ```
 *
 * @experimental
 */
export class EditableTreeNode {
  private node: TreeNode
  // private _parent?: EditableTreeNode

  constructor(node: TreeNode) {
    this.node = node
  }

  /**
   * Remove and detach the current route node from the tree. Subsequently, its children will be removed as well.
   */
  delete() {
    return this.node.delete()
  }

  /**
   * Inserts a new route as a child of this route. This route cannot use `definePage()`. If it was meant to be included,
   * add it to the `routesFolder` option.
   */
  insert(path: string, filePath: string) {
    const extDotIndex = filePath.lastIndexOf('.')
    const ext = filePath.slice(extDotIndex)
    if (!path.endsWith(ext)) {
      path += ext
    }
    // adapt paths as they should match a file system
    let addBackLeadingSlash = false
    if (path.startsWith('/')) {
      // at the root of the tree, the path is relative to the root so we remove
      // the leading slash
      path = path.slice(1)
      // but in other places we need to instruct the path is at the root so we change it afterwards
      addBackLeadingSlash = !this.node.isRoot()
    }
    const node = this.node.insert(path, filePath)
    const editable = new EditableTreeNode(node)
    if (addBackLeadingSlash) {
      editable.path = '/' + node.path
    }
    // TODO: read definePage from file or is this fine?
    return editable
  }

  /**
   * Get an editable version of the parent node if it exists.
   */
  get parent() {
    return this.node.parent && new EditableTreeNode(this.node.parent)
  }

  /**
   * Return a Map of the files associated to the current route. The key of the map represents the name of the view (Vue
   * Router feature) while the value is the file path. By default, the name of the view is `default`.
   */
  get components() {
    return this.node.value.components
  }

  /**
   * Name of the route. Note that **all routes are named** but when the final `routes` array is generated, routes
   * without a `component` will not include their `name` property to avoid accidentally navigating to them and display
   * nothing. {@see isPassThrough}
   */
  get name(): string {
    return this.node.name
  }

  /**
   * Override the name of the route.
   */
  set name(name: string | undefined) {
    this.node.value.addEditOverride({ name })
  }

  /**
   * Whether the route is a pass-through route. A pass-through route is a route that does not have a component and is
   * used to group other routes under the same prefix `path` and/or `meta` properties.
   */
  get isPassThrough() {
    return this.node.value.components.size === 0
  }

  /**
   * Meta property of the route as an object. Note this property is readonly and will be serialized as JSON. It won't contain the meta properties defined with `definePage()` as it could contain expressions **but it does contain the meta properties defined with `<route>` blocks**.
   */
  get meta(): Readonly<RouteMeta> {
    return this.node.metaAsObject
  }

  /**
   * Override the meta property of the route. This will discard any other meta property defined with `<route>` blocks or
   * through other means.
   */
  set meta(meta: RouteMeta) {
    this.node.value.removeOverride('meta')
    this.node.value.setEditOverride('meta', meta)
  }

  /**
   * Add meta properties to the route keeping the existing ones. The passed object will be deeply merged with the
   * existing meta object if any. Note that the meta property is later on serialized as JSON so you can't pass functions
   * or any other non-serializable value.
   */
  addToMeta(meta: Partial<RouteMeta>) {
    this.node.value.addEditOverride({ meta })
  }

  /**
   * Path of the route without parent paths.
   */
  get path() {
    return this.node.path
  }

  /**
   * Override the path of the route. You must ensure `params` match with the existing path.
   */
  set path(path: string) {
    if (!path.startsWith('/')) {
      warn(
        `Only absolute paths are supported. Make sure that "${path}" starts with a slash "/".`
      )
      return
    }
    this.node.value.addEditOverride({ path })
  }

  /**
   * Alias of the route.
   */
  get alias() {
    return this.node.value.overrides.alias
  }

  /**
   * Add an alias to the route.
   *
   * @param alias - Alias to add to the route
   */
  addAlias(alias: CustomRouteBlock['alias']) {
    this.node.value.addEditOverride({ alias })
  }

  /**
   * Array of the route params and all of its parent's params.
   */
  get params() {
    return this.node.params
  }

  /**
   * Path of the route including parent paths.
   */
  get fullPath() {
    return this.node.fullPath
  }

  /**
   * Computes an array of EditableTreeNode from the current node. Differently from iterating over the tree, this method
   * **only returns direct children**.
   */
  get children(): EditableTreeNode[] {
    return [...this.node.children.values()].map(
      (node) => new EditableTreeNode(node)
    )
  }

  /**
   * DFS traversal of the tree.
   * @example
   * ```ts
   * for (const node of tree) {
   *   // ...
   * }
   * ```
   */
  *traverseDFS(): Generator<EditableTreeNode, void, unknown> {
    // The root node is not a route, so we skip it
    if (!this.node.isRoot()) {
      yield this
    }
    for (const [_name, child] of this.node.children) {
      yield* new EditableTreeNode(child).traverseDFS()
    }
  }

  *[Symbol.iterator](): Generator<EditableTreeNode, void, unknown> {
    yield* this.traverseBFS()
  }

  /**
   * BFS traversal of the tree as a generator.
   *
   * @example
   * ```ts
   * for (const node of tree) {
   *   // ...
   * }
   * ```
   */
  *traverseBFS(): Generator<EditableTreeNode, void, unknown> {
    for (const [_name, child] of this.node.children) {
      yield new EditableTreeNode(child)
    }
    // we need to traverse again in case the user removed a route
    for (const [_name, child] of this.node.children) {
      yield* new EditableTreeNode(child).traverseBFS()
    }
  }
}
