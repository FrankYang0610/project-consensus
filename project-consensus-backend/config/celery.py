#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Celery configuration for asynchronous task processing.

This module initializes and configures Celery for the Django project.
Used primarily for sending emails asynchronously to avoid blocking HTTP requests.
"""

from __future__ import absolute_import, unicode_literals

import os
from celery import Celery

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


@app.task(bind=True, ignore_result=False)
def debug_task(self):
    """Debug task to test Celery is working correctly."""
    print(f'Request: {self.request!r}')
    return str(self.request.id)
