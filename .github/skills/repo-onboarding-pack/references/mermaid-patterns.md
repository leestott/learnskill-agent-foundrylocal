# Mermaid Diagram Patterns

Templates for common architecture diagrams. Use these as starting points when generating component diagrams.

## Basic Flowchart

```mermaid
graph TD
    A[Start] --> B[Process]
    B --> C{Decision}
    C -->|Yes| D[Action A]
    C -->|No| E[Action B]
    D --> F[End]
    E --> F
```

## Layered Architecture (MVC, Clean Architecture)

```mermaid
graph TD
    subgraph Presentation
        UI[UI/Views]
        Controllers[Controllers]
    end
    
    subgraph Business
        Services[Services]
        Domain[Domain Models]
    end
    
    subgraph Data
        Repos[Repositories]
        DB[(Database)]
    end
    
    UI --> Controllers
    Controllers --> Services
    Services --> Domain
    Services --> Repos
    Repos --> DB
```

## Microservices Architecture

```mermaid
graph LR
    subgraph Gateway
        API[API Gateway]
    end
    
    subgraph Services
        Auth[Auth Service]
        Users[User Service]
        Orders[Order Service]
        Products[Product Service]
    end
    
    subgraph Data
        AuthDB[(Auth DB)]
        UsersDB[(Users DB)]
        OrdersDB[(Orders DB)]
        ProductsDB[(Products DB)]
    end
    
    Client --> API
    API --> Auth
    API --> Users
    API --> Orders
    API --> Products
    
    Auth --> AuthDB
    Users --> UsersDB
    Orders --> OrdersDB
    Products --> ProductsDB
```

## Frontend/Backend Split

```mermaid
graph TD
    subgraph Frontend
        React[React App]
        Components[Components]
        State[State Management]
    end
    
    subgraph Backend
        Express[Express Server]
        Routes[API Routes]
        Middleware[Middleware]
    end
    
    subgraph External
        DB[(Database)]
        Cache[(Redis)]
        Storage[Cloud Storage]
    end
    
    React --> Components
    React --> State
    React --> |HTTP| Express
    Express --> Routes
    Express --> Middleware
    Routes --> DB
    Routes --> Cache
    Routes --> Storage
```

## CLI Tool Structure

```mermaid
graph TD
    subgraph CLI
        Entry[CLI Entry Point]
        Commands[Commands]
        Options[Options Parser]
    end
    
    subgraph Core
        Scanner[Scanner]
        Analyzer[Analyzer]
        Generator[Generator]
    end
    
    subgraph Output
        Files[File Writer]
        Console[Console Output]
    end
    
    Entry --> Commands
    Entry --> Options
    Commands --> Scanner
    Commands --> Analyzer
    Commands --> Generator
    Scanner --> Analyzer
    Analyzer --> Generator
    Generator --> Files
    Generator --> Console
```

## Event-Driven Architecture

```mermaid
graph LR
    subgraph Producers
        API[API]
        Worker[Worker]
    end
    
    subgraph Messaging
        Queue[Message Queue]
        Topic[Event Topic]
    end
    
    subgraph Consumers
        Handler1[Handler A]
        Handler2[Handler B]
        Handler3[Handler C]
    end
    
    API --> Queue
    Worker --> Topic
    Queue --> Handler1
    Topic --> Handler2
    Topic --> Handler3
```

## Monorepo Structure

```mermaid
graph TD
    Root[Root]
    
    subgraph packages
        Core[core/]
        Utils[utils/]
        Types[types/]
    end
    
    subgraph apps
        Web[web/]
        API[api/]
        CLI[cli/]
    end
    
    subgraph config
        ESLint[.eslintrc]
        TSConfig[tsconfig.json]
        TS[turbo.json]
    end
    
    Root --> packages
    Root --> apps
    Root --> config
    
    Web --> Core
    Web --> Utils
    API --> Core
    API --> Types
    CLI --> Utils
    CLI --> Types
```

## Data Flow Diagram

```mermaid
graph LR
    User((User))
    
    subgraph System
        Input[Input Handler]
        Validate[Validator]
        Process[Processor]
        Store[Data Store]
        Output[Output Handler]
    end
    
    User --> Input
    Input --> Validate
    Validate --> Process
    Process --> Store
    Store --> Output
    Output --> User
```

## Sequence Diagram (for flows)

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant API
    participant Database
    
    User->>Frontend: Submit Form
    Frontend->>API: POST /api/data
    API->>Database: INSERT
    Database-->>API: Success
    API-->>Frontend: 201 Created
    Frontend-->>User: Show Success
```

## Tips for Good Diagrams

### Do's
- Use meaningful node IDs (`AuthService` not `A1`)
- Group related components with subgraphs
- Keep labels short but descriptive
- Show data flow direction
- Limit to 15-20 nodes maximum

### Don'ts
- Don't include every file (show components)
- Don't use generic labels ("Box 1")
- Don't make it too complex
- Don't mix diagram types

### Styling

```mermaid
graph TD
    classDef primary fill:#0969da,stroke:#0969da,color:#fff
    classDef secondary fill:#8250df,stroke:#8250df,color:#fff
    classDef external fill:#bf8700,stroke:#bf8700,color:#fff
    
    A[Primary]:::primary
    B[Secondary]:::secondary
    C[External]:::external
```

### Node Shapes

- `[text]` - Rectangle (default)
- `(text)` - Rounded rectangle
- `{text}` - Diamond (decision)
- `([text])` - Stadium
- `[(text)]` - Cylinder (database)
- `((text))` - Circle
