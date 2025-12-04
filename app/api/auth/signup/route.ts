import { NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { createSession, setSessionCookie } from "@/lib/session";
import bcrypt from "bcryptjs";

/**
 * Sign Up API Endpoint
 * Creates new user and establishes session
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password, firstName, lastName, company, jobTitle } = body;

    // Validate required fields
    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      );
    }

    // Password validation (minimum 6 characters for MVP)
    if (password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters" },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existingUser = await db.query.users.findFirst({
      where: eq(users.email, email.toLowerCase()),
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "Email already registered" },
        { status: 409 }
      );
    }

    // Hash password before storing
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Create new user
    const [newUser] = await db
      .insert(users)
      .values({
        email: email.toLowerCase(),
        passwordHash,
        firstName: firstName || null,
        lastName: lastName || null,
        company: company || null,
        jobTitle: jobTitle || null,
      })
      .returning();

    // Create session token
    const token = await createSession({
      userId: newUser.id,
      email: newUser.email,
    });

    // Set session cookie
    await setSessionCookie(token);

    return NextResponse.json({
      success: true,
      user: {
        id: newUser.id,
        email: newUser.email,
        firstName: newUser.firstName,
        lastName: newUser.lastName,
        company: newUser.company,
      },
    });
  } catch (error) {
    console.error("Error during sign up:", error);
    return NextResponse.json(
      { error: "Sign up failed" },
      { status: 500 }
    );
  }
}
