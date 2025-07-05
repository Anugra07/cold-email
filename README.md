# Cold Outreach Backend API

A production-ready Express.js backend for automated cold-outreach platform with AI-powered email generation, web scraping, and multi-provider email sending capabilities.

## 🚀 Features

- **Campaign Management**: Create, manage, and track email campaigns
- **AI Email Generation**: OpenAI and Hugging Face integration for personalized email content
- **Web Scraping**: LinkedIn profile scraping with Puppeteer fallback
- **Multi-Provider Email**: Automatic failover between Gmail, SendGrid, and Brevo
- **Background Jobs**: Bull queues with Redis for async processing
- **Real-time Analytics**: Campaign performance metrics and tracking
- **Rate Limiting**: Redis-backed rate limiting with IP-based throttling
- **Health Monitoring**: Comprehensive health checks and Prometheus metrics
- **Security**: Helmet, CORS, input validation, and security headers
- **File Uploads**: S3 and local file storage support
- **Logging**: Structured logging with Winston and daily rotation

## 🛠 Technology Stack

- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Database**: MongoDB with Prisma ORM
- **Cache/Queue**: Redis with Bull
- **AI Providers**: OpenAI, Hugging Face
- **Email Providers**: Gmail SMTP, SendGrid, Brevo
- **Scraping**: Axios, Cheerio, Puppeteer
- **Monitoring**: Prometheus, Grafana
- **Security**: Helmet, CORS, Rate Limiting
- **Validation**: Joi, Celebrate
- **Logging**: Winston with daily rotation

## 📋 Prerequisites

- Node.js 18+ and npm 9+
- MongoDB 5.0+
- Redis 6.0+
- Docker and Docker Compose (optional)

## 🔧 Installation

### Local Development Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd cold-outreach-backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment configuration**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Database setup**
   ```bash
   # Generate Prisma client
   npm run prisma:generate
   
   # Push database schema
   npm run prisma:push
   
   # Optional: Open Prisma Studio
   npm run prisma:studio
   ```

5. **Start development server**
   ```bash
   npm run dev
   ```

### Docker Development Setup

1. **Start all services**
   ```bash
   docker-compose up -d
   ```

2. **Start with admin interfaces**
   ```bash
   docker-compose --profile admin up -d
   ```

3. **Start with monitoring**
   ```bash
   docker-compose --profile monitoring up -d
   ```

4. **View logs**
   ```bash
   docker-compose logs -f api
   ```

## ⚙️ Environment Variables

Create a `.env` file based on `.env.example`:

### Required Variables

```bash
# Database
DATABASE_URL="mongodb://localhost:27017/cold-outreach"

# Security
JWT_SECRET="your-super-secret-jwt-key"
SESSION_SECRET="your-session-secret"

# AI Providers
OPENAI_API_KEY="sk-your-openai-key"

# Email Provider (at least one required)
SMTP_PRIMARY_HOST="smtp.gmail.com"
SMTP_PRIMARY_USER="your-email@gmail.com"
SMTP_PRIMARY_PASS="your-app-password"
```

### Optional Variables

```bash
# Redis
REDIS_URL="redis://localhost:6379"

# Additional AI Provider
HUGGINGFACE_API_KEY="hf_your-huggingface-key"

# Additional Email Providers
SMTP_SECONDARY_HOST="smtp.sendgrid.net"
SMTP_SECONDARY_USER="apikey"
SMTP_SECONDARY_PASS="your-sendgrid-key"

# AWS S3 (for file uploads)
AWS_ACCESS_KEY_ID="your-aws-key"
AWS_SECRET_ACCESS_KEY="your-aws-secret"
AWS_S3_BUCKET="your-bucket-name"

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=100

# Logging
LOG_LEVEL="info"
```

## 🚀 Running the Application

### Development
```bash
npm run dev          # Start with nodemon
npm run dev:debug    # Start with debug mode
```

### Production
```bash
npm start           # Start production server
```

### Database Operations
```bash
npm run prisma:generate    # Generate Prisma client
npm run prisma:push       # Push schema to database
npm run prisma:migrate    # Create and run migrations
npm run prisma:studio     # Open Prisma Studio
```

### Testing
```bash
npm test                  # Run all tests
npm run test:watch       # Run tests in watch mode
npm run test:integration # Run integration tests only
```

### Code Quality
```bash
npm run lint             # Lint code
npm run lint:fix         # Fix linting issues
npm run format           # Format code with Prettier
```

## 📚 API Documentation

Once the server is running, visit:
- **Swagger UI**: http://localhost:3000/api-docs
- **Health Check**: http://localhost:3000/health
- **Metrics**: http://localhost:3000/metrics

### Key Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Basic health check |
| GET | `/health/detailed` | Detailed system health |
| GET | `/metrics` | Prometheus metrics |
| GET | `/api/v1/campaigns` | List campaigns |
| POST | `/api/v1/campaigns` | Create campaign |
| GET | `/api/v1/prospects` | List prospects |
| POST | `/api/v1/scraping/linkedin` | Scrape LinkedIn profiles |
| POST | `/api/v1/ai/generate-email` | Generate AI email |
| POST | `/api/v1/emails/send` | Send email |

## 🐳 Docker Deployment

### Production Build
```bash
# Build production image
docker build -t cold-outreach-backend .

# Run container
docker run -p 3000:3000 \
  -e DATABASE_URL="your-mongodb-url" \
  -e REDIS_URL="your-redis-url" \
  -e JWT_SECRET="your-jwt-secret" \
  -e OPENAI_API_KEY="your-openai-key" \
  cold-outreach-backend
```

### Docker Compose Production
```bash
# Production deployment
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

## ☁️ Cloud Deployment

### Railway
1. Fork this repository
2. Connect to Railway
3. Set environment variables
4. Deploy automatically

### Render
1. Connect repository to Render
2. Configure build command: `npm install && npm run prisma:generate`
3. Configure start command: `npm start`
4. Set environment variables
5. Deploy

### AWS ECS/Fargate
1. Build and push Docker image to ECR
2. Create ECS task definition
3. Configure service with load balancer
4. Set environment variables via Parameter Store

### Kubernetes
```bash
# Apply Kubernetes manifests
kubectl apply -f k8s/
```

## 🔍 Monitoring and Observability

### Health Checks
- **Basic**: `GET /health`
- **Detailed**: `GET /health/detailed`
- **Readiness**: `GET /health/ready`
- **Liveness**: `GET /health/live`

### Metrics
- **Prometheus**: `GET /metrics`
- **JSON Format**: `GET /metrics/json`

### Logging
Logs are written to:
- Console (development)
- `logs/combined-YYYY-MM-DD.log`
- `logs/error-YYYY-MM-DD.log`
- `logs/access-YYYY-MM-DD.log`

### Admin Interfaces (Development)
- **MongoDB**: http://localhost:8081 (admin/admin)
- **Redis**: http://localhost:8082 (admin/admin)
- **Grafana**: http://localhost:3001 (admin/admin)
- **Prometheus**: http://localhost:9090

## 🧪 Testing

### Test Structure
```
tests/
├── unit/           # Unit tests
├── integration/    # Integration tests
├── fixtures/       # Test data
└── helpers/        # Test utilities
```

### Running Tests
```bash
npm test                 # All tests
npm run test:unit       # Unit tests only
npm run test:integration # Integration tests only
npm run test:coverage   # With coverage report
```

## 🔐 Security

### Security Features
- **Helmet**: Security headers
- **CORS**: Cross-origin resource sharing
- **Rate Limiting**: IP-based throttling
- **Input Validation**: Joi schema validation
- **Authentication**: JWT tokens
- **Encryption**: bcrypt password hashing
- **File Upload**: Type and size validation

### Security Best Practices
- Use environment variables for secrets
- Enable HTTPS in production
- Regularly update dependencies
- Monitor for security vulnerabilities
- Use non-root Docker user
- Implement proper error handling

## 🔧 Configuration

### Rate Limiting
```javascript
// Default configuration
RATE_LIMIT_WINDOW_MS=900000  // 15 minutes
RATE_LIMIT_MAX=100          // 100 requests per window
```

### Email Providers
The system supports multiple email providers with automatic failover:
1. Primary: Gmail SMTP
2. Secondary: SendGrid
3. Tertiary: Brevo

### AI Providers
- **Primary**: OpenAI (gpt-3.5-turbo)
- **Fallback**: Hugging Face (configurable model)

## 📊 Performance

### Optimization Features
- **Connection Pooling**: Database and Redis
- **Caching**: Redis-based caching
- **Compression**: Gzip response compression
- **Rate Limiting**: Prevent abuse
- **Background Jobs**: Async processing
- **Metrics**: Performance monitoring

### Performance Tips
- Use Redis for caching frequently accessed data
- Implement database indexes for common queries
- Use pagination for large datasets
- Monitor memory usage and optimize queries
- Use CDN for static assets

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

### Development Guidelines
- Follow existing code style
- Add JSDoc comments for functions
- Write tests for new features
- Update documentation
- Use conventional commit messages

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Documentation**: [API Docs](http://localhost:3000/api-docs)
- **Issues**: [GitHub Issues](https://github.com/your-repo/issues)
- **Email**: support@example.com

## 🗺 Roadmap

- [ ] WebSocket support for real-time updates
- [ ] Advanced analytics and reporting
- [ ] Email template builder
- [ ] A/B testing for email campaigns
- [ ] Advanced prospect scoring
- [ ] Integration with CRM systems
- [ ] Mobile app API
- [ ] Multi-tenant support

---

Built with ❤️ for automated cold outreach success.
