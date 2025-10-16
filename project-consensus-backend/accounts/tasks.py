#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Celery tasks for accounts app.

All asynchronous tasks related to user accounts, such as sending emails.
"""

from __future__ import absolute_import, unicode_literals

import logging
from celery import shared_task
from django.conf import settings

from .services.email_service import EmailService

logger = logging.getLogger(__name__)


@shared_task(
    bind=True,
    max_retries=3,
    default_retry_delay=60,  # Retry after 60 seconds
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_backoff_max=600,  # Max 10 minutes
    retry_jitter=True,
)
def send_verification_email_async(
    self,
    email: str,
    code: str,
    language: str = 'zh-CN',
    ttl_minutes: int = 15
):
    """
    Send verification code email asynchronously.
    
    Args:
        email: Recipient email address
        code: 6-digit verification code
        language: Email language (zh-CN or en)
        ttl_minutes: Code validity period in minutes
        
    Returns:
        dict: Resend API response if sent successfully
        
    Raises:
        Exception: If email sending fails after all retries
    """
    try:
        email_service = EmailService()
        
        logger.info(
            f"[Celery Task] Sending verification email to {email}",
            extra={
                'task_id': self.request.id,
                'email': email,
                'language': language,
                'retry_count': self.request.retries,
            }
        )
        
        response = email_service.send_verification_code(
            email=email,
            code=code,
            language=language,
            ttl_minutes=ttl_minutes
        )
        
        logger.info(
            f"[Celery Task] Verification email sent successfully to {email}",
            extra={
                'task_id': self.request.id,
                'email': email,
                'resend_id': response.get('id') if response else None,
            }
        )
        
        return response
        
    except Exception as e:
        logger.error(
            f"[Celery Task] Failed to send verification email to {email}",
            extra={
                'task_id': self.request.id,
                'email': email,
                'error': str(e),
                'error_type': type(e).__name__,
                'retry_count': self.request.retries,
            },
            exc_info=True
        )
        
        # Re-raise exception to trigger Celery retry mechanism
        raise


@shared_task(
    bind=True,
    max_retries=3,
    default_retry_delay=60,
    autoretry_for=(Exception,),
    retry_backoff=True,
)
def send_password_reset_email_async(
    self,
    email: str,
    reset_link: str,
    language: str = 'zh-CN'
):
    """
    Send password reset email asynchronously (placeholder for future implementation).
    
    Args:
        email: Recipient email address
        reset_link: Password reset URL
        language: Email language
        
    Returns:
        dict: Resend API response if sent successfully
    """
    try:
        email_service = EmailService()
        
        logger.info(
            f"[Celery Task] Sending password reset email to {email}",
            extra={
                'task_id': self.request.id,
                'email': email,
                'language': language,
            }
        )
        
        response = email_service.send_password_reset(
            email=email,
            reset_link=reset_link,
            language=language
        )
        
        logger.info(
            f"[Celery Task] Password reset email sent successfully to {email}",
            extra={
                'task_id': self.request.id,
                'email': email,
            }
        )
        
        return response
        
    except Exception as e:
        logger.error(
            f"[Celery Task] Failed to send password reset email to {email}",
            extra={
                'task_id': self.request.id,
                'email': email,
                'error': str(e),
                'error_type': type(e).__name__,
            },
            exc_info=True
        )
        raise
