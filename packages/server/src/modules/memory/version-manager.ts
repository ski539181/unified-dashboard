// Version Manager — Agent OS v6.1
import { MemoryVersion } from './types';

export class VersionManager {
  /**
   * Parse version string "1.2.3" to MemoryVersion
   */
  static parse(version: string): MemoryVersion {
    const parts = version.split('.').map(Number);
    return {
      major: parts[0] || 0,
      minor: parts[1] || 0,
      patch: parts[2] || 0,
    };
  }

  /**
   * Serialize MemoryVersion to string "1.2.3"
   */
  static serialize(version: MemoryVersion): string {
    return `${version.major}.${version.minor}.${version.patch}`;
  }

  /**
   * Increment version based on change type
   */
  static increment(version: MemoryVersion, type: 'major' | 'minor' | 'patch'): MemoryVersion {
    switch (type) {
      case 'major':
        return { major: version.major + 1, minor: 0, patch: 0 };
      case 'minor':
        return { major: version.major, minor: version.minor + 1, patch: 0 };
      case 'patch':
        return { major: version.major, minor: version.minor, patch: version.patch + 1 };
    }
  }

  /**
   * Compare two versions: -1 (a < b), 0 (equal), 1 (a > b)
   */
  static compare(a: MemoryVersion, b: MemoryVersion): number {
    if (a.major !== b.major) return a.major < b.major ? -1 : 1;
    if (a.minor !== b.minor) return a.minor < b.minor ? -1 : 1;
    if (a.patch !== b.patch) return a.patch < b.patch ? -1 : 1;
    return 0;
  }

  /**
   * Check if version a is newer than b
   */
  static isNewer(a: MemoryVersion, b: MemoryVersion): boolean {
    return VersionManager.compare(a, b) > 0;
  }

  /**
   * Get initial version
   */
  static initial(): MemoryVersion {
    return { major: 1, minor: 0, patch: 0 };
  }
}
