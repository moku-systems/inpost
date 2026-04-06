# @moku-systems/inpost-international

> InPost International API client for Node.js with OAuth2 authentication

**🚧 Status:** Work in progress. OAuth2 infrastructure is ready, waiting for International API specification from InPost.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## 📦 What's Ready

- ✅ **OAuth2 Authentication** - Complete implementation with token refresh, caching, and expiry handling
- ✅ **Retry Logic** - Exponential backoff for rate limits, linear backoff for server errors
- ✅ **Error Handling** - Comprehensive error types with classification helpers
- ✅ **Type Safety** - Full TypeScript support with exported types
- ✅ **Tests** - 100% test coverage for auth and core functionality

## ⏳ What's Coming

- ⬜ InternationalClient wrapper
- ⬜ Shipments service
- ⬜ Tracking service
- ⬜ Points/Lockers service
- ⬜ API-specific type definitions
- ⬜ Complete documentation

## 🔗 Related

For the **legacy ShipX API** (Polish market only), see:

- [@moku-systems/inpost-shipx](https://github.com/moku-systems/inpost-shipx) _(coming soon)_

## 📚 Development

This package is under active development. The OAuth2 authentication layer is production-ready and tested, but the high-level API client is waiting for the International API specification.

### Architecture
