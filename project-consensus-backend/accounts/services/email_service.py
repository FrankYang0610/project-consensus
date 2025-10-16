#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Email service module for sending transactional emails.
Uses Resend API for reliable email delivery.
"""

from __future__ import annotations

import logging
import time
from typing import Optional, Dict, Any

from django.conf import settings
from django.template.loader import render_to_string

import resend


logger = logging.getLogger(__name__)


class EmailService:
    """
    Service class for handling all email operations.
    
    Features:
    - Template-based email composition
    - Multi-language support (zh-CN, en)
    - Detailed logging and error handling
    """
    
    def __init__(self):
        """Initialize the email service with Resend API key."""
        self.api_key = getattr(settings, 'RESEND_API_KEY', None)
        self.from_address = getattr(settings, 'EMAIL_FROM_ADDRESS', 'PolyU Life <noreply@polyu.life>')
        self.reply_to = getattr(settings, 'EMAIL_REPLY_TO', 'noreply@polyu.life')
        self.enabled = getattr(settings, 'EMAIL_ENABLED', False)
        
        if self.enabled and not self.api_key:
            logger.error("EMAIL_ENABLED is True but RESEND_API_KEY is not configured")
            raise ValueError("RESEND_API_KEY must be set when EMAIL_ENABLED is True")
        
        if self.api_key:
            resend.api_key = self.api_key
    
    def send_verification_code(
        self, 
        email: str, 
        code: str, 
        language: str = 'zh-CN',
        ttl_minutes: int = 15
    ) -> Optional[Dict[str, Any]]:
        """
        Send verification code email to user.
        
        Args:
            email: Recipient email address
            code: 6-digit verification code
            language: Email language (zh-CN or en)
            ttl_minutes: Code validity period in minutes
            
        Returns:
            Resend API response dict if sent, None if email disabled
            
        Raises:
            Exception: If email sending fails
        """
        if not self.enabled:
            logger.warning(
                f"[DEV MODE] Email sending disabled. Code for {email}: {code}"
            )
            return None
        
        start_time = time.time()
        
        try:
            # Normalize language code
            lang = 'zh' if language.startswith('zh') else 'en'
            
            # Render subject from template
            subject = render_to_string(
                f'emails/verification_code/subject_{lang}.txt',
                {'code': code, 'ttl_minutes': ttl_minutes}
            ).strip()
            
            # Render HTML body
            html_body = render_to_string(
                f'emails/verification_code/body_{lang}.html',
                {
                    'code': code,
                    'ttl_minutes': ttl_minutes,
                    'email': email,
                }
            )
            
            # Render plain text body (fallback)
            text_body = render_to_string(
                f'emails/verification_code/body_{lang}.txt',
                {
                    'code': code,
                    'ttl_minutes': ttl_minutes,
                    'email': email,
                }
            )
            
            # Prepare email payload
            payload = {
                'from': self.from_address,
                'to': [email],
                'subject': subject,
                'html': html_body,
                'text': text_body,
                'reply_to': [self.reply_to],
                'tags': [
                    {'name': 'type', 'value': 'verification'},
                    {'name': 'language', 'value': lang}
                ],
            }
            
            # Send email via Resend
            logger.info("Sending verification email", extra={"email": email, "language": lang})
            response = resend.Emails.send(payload)
            
            duration = time.time() - start_time
            logger.info(
                "Verification email sent successfully",
                extra={
                    'email': email,
                    'duration_ms': int(duration * 1000),
                    'language': lang,
                    'resend_id': response.get('id'),
                }
            )
            
            return response
            
        except Exception as e:
            duration = time.time() - start_time
            logger.error(
                "Failed to send verification email",
                extra={
                    'email': email,
                    'duration_ms': int(duration * 1000),
                    'error': str(e),
                    'error_type': type(e).__name__,
                },
                exc_info=True
            )
            raise
    
    def send_password_reset(
        self, 
        email: str, 
        reset_link: str,
        language: str = 'zh-CN'
    ) -> Optional[Dict[str, Any]]:
        """
        Send password reset email (placeholder for future implementation).
        
        Args:
            email: Recipient email address
            reset_link: Password reset URL
            language: Email language
            
        Returns:
            Resend API response dict if sent, None if email disabled
        """
        if not self.enabled:
            logger.warning(
                f"[DEV MODE] Email sending disabled. Reset link for {email}: {reset_link}"
            )
            return None
        
        # TODO: Implement password reset email template and logic
        logger.info(f"Password reset email not yet implemented for {email}")
        return None
