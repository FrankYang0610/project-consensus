#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Celery configuration for asynchronous task processing.

This module initializes and configures Celery for the Django project.
Used primarily for sending emails asynchronously to avoid blocking HTTP requests.

Reliability features:
- Auto-reconnect on broker connection loss
- Task retries with exponential backoff
- TCP keepalive for Redis connections
- Health checks every 30 seconds
"""

from __future__ import absolute_import, unicode_literals

import os
import logging
from celery import Celery
from celery.signals import worker_ready, worker_shutdown

logger = logging.getLogger(__name__)

# Set the default Django settings module for the 'celery' program.
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

# Create Celery application
app = Celery('project-consensus')

# Load configuration from Django settings with 'CELERY_' prefix
# Example: CELERY_BROKER_URL in settings.py
app.config_from_object('django.conf:settings', namespace='CELERY')

# Auto-discover tasks in all installed Django apps
# Will look for tasks.py in each app
app.autodiscover_tasks()


@worker_ready.connect
def worker_ready_handler(sender=None, **kwargs):
    """Log when worker is ready and connected to broker."""
    logger.info("Celery worker is ready and connected to broker")


@worker_shutdown.connect
def worker_shutdown_handler(sender=None, **kwargs):
    """Log when worker is shutting down."""
    logger.info("Celery worker is shutting down")


@app.task(bind=True, ignore_result=False)
def debug_task(self):
    """Debug task to test Celery is working correctly."""
    print(f'Request: {self.request!r}')
    return str(self.request.id)
