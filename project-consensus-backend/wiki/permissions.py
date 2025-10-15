"""
Wiki application permissions.

Custom permission classes for controlling access to wiki resources.
"""

from rest_framework import permissions


class IsAdminOrReadOnly(permissions.BasePermission):
    """
    自定义权限：管理员可以执行所有操作，普通用户只读
    Custom permission: Admins can perform all operations, regular users read-only.
    
    - Safe methods (GET, HEAD, OPTIONS): Allowed for all users
    - Unsafe methods (POST, PUT, PATCH, DELETE): Allowed only for staff users
    
    This permission is used to protect wiki pages and categories, ensuring that
    only administrators can create, update, or delete content, while all users
    can view published content.
    """
    
    def has_permission(self, request, view):
        """
        检查用户是否有权限访问视图 / Check if user has permission to access the view
        
        Args:
            request: The request object
            view: The view being accessed
        
        Returns:
            bool: True if permission granted, False otherwise
        """
        # 读操作：所有用户都允许
        # Read operations: Allowed for all users
        if request.method in permissions.SAFE_METHODS:
            return True
        
        # 写操作：仅管理员（is_staff=True）允许
        # Write operations: Only allowed for staff users
        return request.user and request.user.is_authenticated and request.user.is_staff
    
    def has_object_permission(self, request, view, obj):
        """
        检查用户是否有权限访问特定对象 / Check if user has permission to access a specific object
        
        Args:
            request: The request object
            view: The view being accessed
            obj: The object being accessed
        
        Returns:
            bool: True if permission granted, False otherwise
        """
        # 读操作：所有用户都允许
        # Read operations: Allowed for all users
        if request.method in permissions.SAFE_METHODS:
            return True
        
        # 写操作：仅管理员允许
        # Write operations: Only allowed for staff users
        return request.user and request.user.is_authenticated and request.user.is_staff


class IsStaffUser(permissions.BasePermission):
    """
    仅管理员权限 / Staff users only permission
    
    Denies access to all non-staff users, regardless of the HTTP method.
    Used for admin-only views and actions.
    """
    
    def has_permission(self, request, view):
        """
        检查用户是否是管理员 / Check if user is a staff member
        
        Args:
            request: The request object
            view: The view being accessed
        
        Returns:
            bool: True if user is staff, False otherwise
        """
        return request.user and request.user.is_authenticated and request.user.is_staff
    
    def has_object_permission(self, request, view, obj):
        """
        检查用户是否是管理员（对象级别）/ Check if user is a staff member (object level)
        
        Args:
            request: The request object
            view: The view being accessed
            obj: The object being accessed
        
        Returns:
            bool: True if user is staff, False otherwise
        """
        return request.user and request.user.is_authenticated and request.user.is_staff

