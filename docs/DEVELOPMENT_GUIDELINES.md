# Development Guidelines

## Project Structure

```
diversifi/
├── components/          # Reusable UI components
│   ├── agent/          # AI agent related components
│   ├── onramp/         # Fiat onramp components
│   ├── swap/           # Swap interface components
│   ├── tabs/           # Tab components
│   └── ui/             # Base UI components
├── config/             # Configuration files
├── constants/          # Constants and enums
├── context/            # React context providers
├── docs/               # Documentation
├── hooks/              # Custom React hooks
├── pages/              # Next.js pages
│   ├── api/            # API routes
│   └── *.tsx           # Page components
├── public/             # Static assets
├── services/           # Business logic services
├── styles/             # Global styles
├── types/              # TypeScript type definitions
├── utils/              # Utility functions
├── .env.example        # Environment variables template
├── next.config.js      # Next.js configuration
├── package.json        # Project dependencies
├── tsconfig.json       # TypeScript configuration
└── README.md           # Project overview
```

## Development Setup

### Prerequisites
- Node.js >= 18.0.0
- pnpm package manager
- Git

### Initial Setup
```bash
# Clone the repository
git clone https://github.com/your-org/diversifi.git
cd diversifi

# Install dependencies
pnpm install

# Copy environment variables
cp .env.example .env.local

# Add your API keys to .env.local
# See docs/API_KEYS_AND_DATA_SOURCES.md for details

# Run development server
pnpm dev
```

### Environment Variables
Required environment variables are documented in `.env.example`. For development, you can use mock values for testing, but for production you'll need real API keys.

## Coding Standards

### TypeScript
- Use TypeScript for all new code
- Prefer strict typing over `any`
- Use interfaces for object shapes
- Use types for unions and primitives
- Enable strict mode in `tsconfig.json`

### React Best Practices
- Use functional components with hooks
- Follow the container/presentational pattern
- Use React.memo for performance optimization
- Use useCallback and useMemo appropriately
- Prefer composition over inheritance

### Naming Conventions
- Use PascalCase for components: `SwapInterface.tsx`
- Use camelCase for functions and variables: `calculatePortfolioValue`
- Use UPPER_SNAKE_CASE for constants: `MAX_SLIPPAGE`
- Use kebab-case for filenames: `agent-wealth-guard.tsx`

### File Organization
- Group related files in directories
- Keep components focused on single responsibility
- Separate business logic from UI components
- Use barrel exports in index files

## Component Architecture

### Agent Components
Agent components should follow the pattern of separating concerns between:
- UI presentation
- State management
- Data fetching
- Business logic

### Wallet Integration
Wallet components should abstract the complexity of different wallet providers and present a unified interface to the rest of the application.

### API Routes
API routes should:
- Validate input parameters
- Handle errors gracefully
- Return consistent response formats
- Include proper HTTP status codes
- Implement rate limiting where appropriate

## Testing Strategy

### Unit Tests
- Test individual functions and components
- Use Jest for JavaScript/TypeScript utilities
- Use React Testing Library for component tests
- Aim for 80%+ code coverage on critical paths

### Integration Tests
- Test component interactions
- Test API route functionality
- Test wallet connection flows
- Test swap execution paths

### End-to-End Tests
- Use Playwright or Cypress for critical user flows
- Test complete user journeys
- Test cross-chain functionality
- Test error scenarios

## State Management

### Global State
Use React Context for global state that needs to be accessed by many components:
- Wallet connection state
- User preferences
- Global loading states

### Local State
Use React useState and useEffect for component-specific state.

### Custom Hooks
Create custom hooks to encapsulate complex logic:
- Wallet connection logic
- Data fetching and caching
- Form handling
- Animation controls

## Error Handling

### Client-Side Errors
- Use try/catch blocks for async operations
- Display user-friendly error messages
- Log errors for debugging
- Implement graceful degradation

### Server-Side Errors
- Return appropriate HTTP status codes
- Include error details in response body
- Log server-side errors
- Implement circuit breaker patterns for external APIs

## Security Best Practices

### Input Validation
- Validate all user inputs on both client and server
- Sanitize data before processing
- Use allowlists for permitted values
- Escape output to prevent XSS

### API Security
- Implement rate limiting
- Use authentication where required
- Validate API keys
- Use HTTPS for all API communications

### Wallet Security
- Never store private keys in the application
- Use secure wallet connection protocols
- Implement transaction confirmation dialogs
- Warn users about risky operations

## Performance Optimization

### Bundle Size
- Use code splitting for large components
- Lazy load non-critical components
- Optimize images and assets
- Remove unused dependencies

### Rendering Performance
- Use React.memo for expensive components
- Implement virtual scrolling for large lists
- Debounce frequent operations
- Optimize re-renders with useCallback/useMemo

### Network Performance
- Implement smart caching strategies
- Batch API requests where possible
- Use compression for large payloads
- Implement optimistic updates

## Cross-Chain Considerations

### Network Detection
- Properly detect current network
- Handle network switching gracefully
- Validate network compatibility
- Provide clear network indicators

### Token Handling
- Maintain accurate token balances
- Handle token approvals properly
- Implement slippage protection
- Validate token decimals

### Transaction Management
- Track transaction status
- Handle transaction failures
- Implement retry mechanisms
- Provide transaction receipts

## API Integration Patterns

### Data Fetching
- Use SWR or React Query for server state
- Implement proper loading states
- Handle cache invalidation
- Implement pagination for large datasets

### Error Recovery
- Implement retry logic for transient failures
- Provide fallback data when APIs are down
- Notify users of service disruptions
- Log API performance metrics

## Contributing

### Pull Request Process
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Update documentation as needed
6. Submit a pull request
7. Address review comments
8. Merge after approval

### Code Review Checklist
- Does the code follow established patterns?
- Are there adequate tests?
- Is the code properly documented?
- Are there any security concerns?
- Does it meet performance requirements?
- Is it accessible?

## Troubleshooting

### Common Issues
- Wallet connection problems
- Network switching issues
- API rate limiting
- Cross-chain bridge delays

### Debugging Tools
- Browser developer tools
- React DevTools
- Redux DevTools (if applicable)
- Network inspection tools

This development guide provides the foundation for building and maintaining the DiversiFi platform with consistent quality and security standards.