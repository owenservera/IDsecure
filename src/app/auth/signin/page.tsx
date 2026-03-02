'use client';

import { signIn } from "next-auth/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, Lock, AlertCircle } from "lucide-react";

export default function SignIn() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await signIn("credentials", {
      username,
      password,
      redirect: true,
      callbackUrl: "/",
    });

    if (res?.error) {
      setError("Invalid credentials. System access denied.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4">
      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20" />
      
      <Card className="w-full max-w-md bg-slate-900 border-slate-800 text-slate-100 shadow-2xl relative z-10">
        <CardHeader className="text-center space-y-1">
          <div className="mx-auto bg-violet-600 p-3 rounded-2xl w-fit mb-4">
            <Shield className="h-8 w-8 text-white" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">System Authentication</CardTitle>
          <CardDescription className="text-slate-400">
            IDsecure Protocol 4.0 - Secure Access Terminal
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-widest text-slate-500">Officer ID</label>
              <Input
                type="text"
                placeholder="ADMIN-01"
                className="bg-slate-800 border-slate-700 text-slate-100 focus:ring-violet-500"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-widest text-slate-500">Access Token</label>
              <Input
                type="password"
                className="bg-slate-800 border-slate-700 text-slate-100 focus:ring-violet-500"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-red-900/30 border border-red-800 text-red-400 text-sm">
                <AlertCircle className="h-4 w-4" />
                {error}
              </div>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-violet-600 hover:bg-violet-700 text-white h-11 font-bold"
            >
              {loading ? "Verifying..." : "Initialize Uplink"}
            </Button>
          </form>

          <div className="mt-8 flex flex-col items-center gap-2 text-[10px] text-slate-600 uppercase tracking-tighter">
            <div className="flex items-center gap-1">
              <Lock className="h-3 w-3" />
              AES-256 Encrypted Session
            </div>
            <p>© 2026 IDsecure Intelligence Systems</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
