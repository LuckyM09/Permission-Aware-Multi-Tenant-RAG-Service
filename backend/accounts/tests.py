from django.contrib.auth import get_user_model
from django.test import TestCase

User = get_user_model()


class UserModelTests(TestCase):
    def test_create_user_with_email_successful(self):
        """Test creating a new user with an email is successful."""
        email = "alice@tenant-a.com"
        password = "SecurePassword123!"
        user = User.objects.create_user(email=email, password=password)

        self.assertEqual(user.email, email)
        self.assertTrue(user.check_password(password))
        self.assertTrue(user.is_active)
        self.assertFalse(user.is_staff)
        self.assertFalse(user.is_superuser)

    def test_new_user_without_email_raises_error(self):
        """Test creating a user with no email raises a ValueError."""
        with self.assertRaises(ValueError):
            User.objects.create_user(email="", password="SecurePassword123!")

    def test_create_superuser(self):
        """Test creating a new superuser."""
        user = User.objects.create_superuser(
            email="admin@vaultrag.internal",
            password="AdminPassword123!",
        )

        self.assertTrue(user.is_staff)
        self.assertTrue(user.is_superuser)
