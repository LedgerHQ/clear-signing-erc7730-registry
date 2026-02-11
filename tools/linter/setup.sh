#!/bin/bash
# ERC-7730 Linter - Local Setup Script
# This script clones and sets up the python-erc7730 linter for local use
#
# Usage: ./setup.sh
#
# Requirements:
#   - Python 3.12
#   - Git

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo "============================================"
echo -e "${BLUE}ERC-7730 Linter - Local Setup${NC}"
echo "============================================"
echo ""

# Check for required tools
echo "Checking prerequisites..."
command -v git >/dev/null 2>&1 || { echo -e "${RED}❌ git is required${NC}"; exit 1; }
command -v python3 >/dev/null 2>&1 || { echo -e "${RED}❌ python3 is required${NC}"; exit 1; }

# Check Python version (needs 3.12)
PYTHON_VERSION=$(python3 -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')
if [[ "$PYTHON_VERSION" != "3.12" ]]; then
    echo -e "${RED}❌ Python 3.12 is required (found $PYTHON_VERSION)${NC}"
    exit 1
fi
echo -e "${GREEN}✅ All prerequisites found (Python $PYTHON_VERSION)${NC}"
echo ""

# Clone python-erc7730 if not exists
if [ ! -d "python-erc7730" ]; then
    echo -e "${BLUE}📦 Cloning python-erc7730...${NC}"
    git clone --depth 1 https://github.com/LedgerHQ/python-erc7730.git python-erc7730
else
    echo -e "${BLUE}📦 python-erc7730 already cloned, pulling latest...${NC}"
    cd python-erc7730 && git pull && cd ..
fi
echo ""

# Create virtual environment if not exists
if [ ! -d ".venv" ]; then
    echo -e "${BLUE}🐍 Creating virtual environment...${NC}"
    python3 -m venv .venv
else
    echo -e "${BLUE}🐍 Virtual environment already exists${NC}"
fi
echo ""

# Activate virtual environment and install dependencies
echo -e "${BLUE}📥 Installing dependencies...${NC}"
source .venv/bin/activate

# Install PDM in the virtual environment
pip install --quiet pdm

# Install project dependencies
cd python-erc7730
pdm install
cd ..

echo ""
echo "============================================"
echo -e "${GREEN}✅ Setup complete!${NC}"
echo "============================================"
echo ""
echo "Usage:"
echo ""
echo "1. Source the .env file (for Etherscan API key) and activate the environment:"
echo -e "   ${YELLOW}source .env && source tools/linter/.venv/bin/activate${NC}"
echo ""
echo "2. Run the linter:"
echo -e "   ${YELLOW}erc7730 lint registry/${NC}"
echo ""
echo "Or as a one-liner from the repository root:"
echo -e "   ${YELLOW}source .env && source tools/linter/.venv/bin/activate && erc7730 lint registry/${NC}"
echo ""
echo "Example - lint a specific file:"
echo -e "   ${YELLOW}erc7730 lint registry/uniswap/calldata-permit2.json${NC}"
echo ""
echo "Other commands:"
echo -e "   ${YELLOW}erc7730 --help${NC}          Show all available commands"
echo -e "   ${YELLOW}erc7730 format <path>${NC}   Format descriptor files"
echo -e "   ${YELLOW}erc7730 schema${NC}          Print JSON schema"
echo ""
