
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const mongoose = require("mongoose");
const { GoogleGenAI } = require("@google/genai");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const Contact = require("./models/Contact");
const Customer = require("./models/Customer");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.disable("x-powered-by");

// ================= BASIC MIDDLEWARE =================

app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// ================= WEBSITE ENTRY =================

app.get("/", (req, res) => {
    res.redirect("/login.html");
});

// Serve website files
app.use(express.static(__dirname));

// ================= ENVIRONMENT CHECK =================

if (!process.env.MONGODB_URI) {
    console.error("MONGODB_URI is missing in .env");
}

if (!process.env.JWT_SECRET) {
    console.error("JWT_SECRET is missing in .env");
}

if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD) {
    console.error("Admin credentials are missing in .env");
}

// ================= MONGODB CONNECTION =================

mongoose.connect(process.env.MONGODB_URI)
    .then(() => {
        console.log("MongoDB connected successfully!");
    })
    .catch((error) => {
        console.error("MongoDB connection failed:", error.message);
    });

// ================= GEMINI AI SETUP =================

const ai = process.env.GEMINI_API_KEY
    ? new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY
    })
    : null;

// ================= SAIRAM AI ASSISTANT =================

app.post("/ask-ai", async (req, res) => {
    try {
        const question = req.body.question;

        if (!question || typeof question !== "string" || !question.trim()) {
            return res.status(400).json({
                success: false,
                error: "Please enter a question."
            });
        }

        if (!ai) {
            return res.status(500).json({
                success: false,
                error: "AI configuration is missing."
            });
        }

        const response = await ai.models.generateContent({
            model: "gemini-3.8-flash",
            contents: question.trim(),
            config: {
                systemInstruction: `
You are Sairam AI, the official AI assistant
for Sairam Enterprises & Services.

The company provides:
1. Bus cleaning services.
2. Bus repair services.
3. Preventive vehicle maintenance.
4. Fleet support services.

Answer questions about bus cleaning and maintenance.
Explain common vehicle problems.
Help users understand overheating, engine problems,
battery issues and tyre maintenance.
Give helpful fleet maintenance suggestions.
Use simple, clear and professional language.

For serious vehicle problems or safety issues,
recommend consulting a qualified mechanic.

Never claim that you physically inspected a vehicle.
Always respond helpfully and professionally.
`
            }
        });

        const answer = response.text;

        if (!answer) {
            return res.status(502).json({
                success: false,
                error: "AI could not generate an answer. Please try again."
            });
        }

        console.log("Sairam AI response generated successfully!");

        return res.json({
            success: true,
            answer: answer
        });

    } catch (error) {
        console.error("SAIRAM AI ERROR:", error);

        return res.status(500).json({
            success: false,
            error: "AI response failed. Please check the server terminal."
        });
    }
});

// ================= CONTACT FORM =================

app.post("/contact", async (req, res) => {
    try {
        const { name, phone, email, service, message } = req.body;

        if (!name || !phone || !email || !service || !message) {
            return res.status(400).json({
                success: false,
                message: "All fields are required."
            });
        }

        const newContact = new Contact({
            name: name.trim(),
            phone: phone.trim(),
            email: email.trim().toLowerCase(),
            service,
            message
        });

        await newContact.save();

        return res.json({
            success: true,
            message: "Your request has been submitted successfully!"
        });

    } catch (error) {
        console.error("CONTACT FORM ERROR:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to save your request."
        });
    }
});

// ================= CUSTOMER REGISTRATION =================

app.post("/register", async (req, res) => {
    try {
        const { name, phone, email, password } = req.body;

        if (!name || !phone || !email || !password) {
            return res.status(400).json({
                success: false,
                message: "All fields are required."
            });
        }

        if (typeof password !== "string" || password.length < 8) {
            return res.status(400).json({
                success: false,
                message: "Password must contain at least 8 characters."
            });
        }

        const normalizedEmail = email.trim().toLowerCase();
        const normalizedPhone = phone.trim();

        const existingCustomer = await Customer.findOne({
            $or: [
                { email: normalizedEmail },
                { phone: normalizedPhone }
            ]
        });

        if (existingCustomer) {
            return res.status(400).json({
                success: false,
                message: "Customer already exists with this email or phone."
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const newCustomer = new Customer({
            name: name.trim(),
            phone: normalizedPhone,
            email: normalizedEmail,
            password: hashedPassword
        });

        await newCustomer.save();

        return res.status(201).json({
            success: true,
            message: "Customer registered successfully!"
        });

    } catch (error) {
        console.error("REGISTRATION ERROR:", error);

        if (error.code === 11000) {
            return res.status(400).json({
                success: false,
                message: "This email or phone number is already registered."
            });
        }

        return res.status(500).json({
            success: false,
            message: "Registration failed."
        });
    }
});

// ================= CUSTOMER LOGIN =================

app.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: "Email and password are required."
            });
        }

        if (!process.env.JWT_SECRET) {
            return res.status(500).json({
                success: false,
                message: "Authentication configuration is missing."
            });
        }

        const customer = await Customer.findOne({
            email: email.trim().toLowerCase()
        });

        if (!customer) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password."
            });
        }

        const passwordMatch = await bcrypt.compare(
            password,
            customer.password
        );

        if (!passwordMatch) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password."
            });
        }

        const token = jwt.sign(
            {
                id: customer._id.toString(),
                role: "customer"
            },
            process.env.JWT_SECRET,
            {
                expiresIn: "2h",
                algorithm: "HS256"
            }
        );

        return res.json({
            success: true,
            message: "Login successful!",
            token: token,
            customer: {
                id: customer._id,
                name: customer.name,
                email: customer.email
            }
        });

    } catch (error) {
        console.error("CUSTOMER LOGIN ERROR:", error);

        return res.status(500).json({
            success: false,
            message: "Login failed. Please try again."
        });
    }
});

// ================= CUSTOMER AUTHENTICATION =================

function verifyCustomer(req, res, next) {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({
                success: false,
                message: "Please log in to continue."
            });
        }

        const token = authHeader.split(" ")[1];

        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET,
            {
                algorithms: ["HS256"]
            }
        );

        if (decoded.role !== "customer") {
            return res.status(403).json({
                success: false,
                message: "Customer access only."
            });
        }

        req.customer = decoded;
        next();

    } catch (error) {
        return res.status(401).json({
            success: false,
            message: "Your session has expired. Please log in again."
        });
    }
}

// ================= CUSTOMER: VERIFY LOGIN =================

app.get("/customer/verify", verifyCustomer, (req, res) => {
    return res.json({
        success: true,
        message: "Customer authenticated."
    });
});

// ================= ADMIN LOGIN =================

app.post("/admin/login", async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!process.env.ADMIN_EMAIL ||
            !process.env.ADMIN_PASSWORD ||
            !process.env.JWT_SECRET) {
            return res.status(500).json({
                success: false,
                message: "Admin configuration is missing."
            });
        }

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: "Email and password are required."
            });
        }

        const adminEmail = process.env.ADMIN_EMAIL.trim().toLowerCase();

        if (
            email.trim().toLowerCase() !== adminEmail ||
            password !== process.env.ADMIN_PASSWORD
        ) {
            return res.status(401).json({
                success: false,
                message: "Invalid administrator email or password."
            });
        }

        const token = jwt.sign(
            {
                role: "admin",
                email: adminEmail
            },
            process.env.JWT_SECRET,
            {
                expiresIn: "2h",
                algorithm: "HS256"
            }
        );

        return res.json({
            success: true,
            message: "Admin login successful!",
            token: token
        });

    } catch (error) {
        console.error("ADMIN LOGIN ERROR:", error);

        return res.status(500).json({
            success: false,
            message: "Admin login failed."
        });
    }
});

// ================= ADMIN AUTHENTICATION =================

function verifyAdmin(req, res, next) {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({
                success: false,
                message: "Admin access denied. Please log in."
            });
        }

        const token = authHeader.split(" ")[1];

        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET,
            {
                algorithms: ["HS256"]
            }
        );

        if (decoded.role !== "admin") {
            return res.status(403).json({
                success: false,
                message: "Administrator access only."
            });
        }

        req.admin = decoded;
        next();

    } catch (error) {
        return res.status(401).json({
            success: false,
            message: "Invalid or expired admin session. Please log in again."
        });
    }
}

// ================= ADMIN: GET CUSTOMERS =================

app.get("/admin/customers", verifyAdmin, async (req, res) => {
    try {
        const customers = await Customer.find()
            .select("-password")
            .sort({ createdAt: -1 })
            .lean();

        return res.json(customers);

    } catch (error) {
        console.error("ADMIN CUSTOMERS ERROR:", error);

        return res.status(500).json({
            success: false,
            message: "Could not load customers."
        });
    }
});

// ================= ADMIN: GET ENQUIRIES =================

app.get("/admin/enquiries", verifyAdmin, async (req, res) => {
    try {
        const enquiries = await Contact.find()
            .sort({ createdAt: -1 })
            .lean();

        return res.json(enquiries);

    } catch (error) {
        console.error("ADMIN ENQUIRIES ERROR:", error);

        return res.status(500).json({
            success: false,
            message: "Could not load enquiries."
        });
    }
});

// ================= ADMIN: UPDATE ENQUIRY =================

app.put("/admin/enquiries/:id", verifyAdmin, async (req, res) => {
    try {
        const { status, adminMessage } = req.body;

        const allowedStatuses = [
            "Received",
            "Under Review",
            "In Progress",
            "Completed",
            "Rejected"
        ];

        if (status && !allowedStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: "Invalid enquiry status."
            });
        }

        if (
            adminMessage !== undefined &&
            (typeof adminMessage !== "string" || adminMessage.length > 2000)
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid admin message. Maximum 2000 characters."
            });
        }

        const updates = {};

        if (status !== undefined) {
            updates.status = status;
        }

        if (adminMessage !== undefined) {
            updates.adminMessage = adminMessage;
        }

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({
                success: false,
                message: "No enquiry updates provided."
            });
        }

        const updatedEnquiry = await Contact.findByIdAndUpdate(
            req.params.id,
            { $set: updates },
            {
                new: true,
                runValidators: true
            }
        );

        if (!updatedEnquiry) {
            return res.status(404).json({
                success: false,
                message: "Enquiry not found."
            });
        }

        return res.json({
            success: true,
            message: "Enquiry updated successfully!",
            enquiry: updatedEnquiry
        });

    } catch (error) {
        console.error("UPDATE ENQUIRY ERROR:", error);

        return res.status(500).json({
            success: false,
            message: "Could not update enquiry."
        });
    }
});

// ================= ADMIN: CHECK LOGIN =================

app.get("/admin/verify", verifyAdmin, (req, res) => {
    return res.json({
        success: true,
        message: "Administrator authenticated."
    });
});

// ================= TEST API =================

app.get("/api/test", (req, res) => {
    return res.json({
        success: true,
        message: "Sairam Enterprises backend is working!"
    });
});

// ================= START SERVER =================

app.listen(PORT, () => {
    console.log(
        `Sairam Enterprises server running at http://localhost:${PORT}`
    );
});
