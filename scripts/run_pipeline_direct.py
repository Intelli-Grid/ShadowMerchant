"""
Pipeline runner — saves live deal data to MongoDB.
Run from project root: .venv\Scripts\python.exe scripts\run_pipeline_direct.py [--scrapers meesho] [--all]
"""
import sys, os
from pathlib import Path

# Ensure scripts/ directory is on path
scripts_dir = Path(__file__).parent
sys.path.insert(0, str(scripts_dir))
os.chdir(scripts_dir)

# Now forward to the real pipeline
import run_pipeline
run_pipeline.main()
