FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive

# Basic tools
RUN apt-get update && apt-get install -y \
    curl \
    git \
    build-essential \
    ca-certificates

# Node.js 20
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs

# Global tooling (optional but useful for CI)
RUN npm install -g npm

WORKDIR /app

CMD ["bash"]