/**
 * Simple LRU (Least Recently Used) Cache implementation
 */
export class LRUCache<K, V> {
  private cache: Map<K, V>
  private readonly maxSize: number

  constructor(maxSize: number) {
    this.cache = new Map()
    this.maxSize = maxSize
  }

  get(key: K): V | undefined {
    if (!this.cache.has(key)) {
      return undefined
    }

    // Move to end (most recently used)
    const value = this.cache.get(key)!
    this.cache.delete(key)
    this.cache.set(key, value)
    return value
  }

  set(key: K, value: V): void {
    // Delete if exists to re-add at end
    if (this.cache.has(key)) {
      this.cache.delete(key)
    }

    // Add to end
    this.cache.set(key, value)

    // Evict oldest if over capacity
    if (this.cache.size > this.maxSize) {
      const firstKey = this.cache.keys().next().value as K
      if (firstKey !== undefined) {
        this.cache.delete(firstKey)
      }
    }
  }

  clear(): void {
    this.cache.clear()
  }

  get size(): number {
    return this.cache.size
  }
}
